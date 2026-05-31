import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';

export const getDashboardStats = async (req: AuthRequest, res: Response) => {
  const totalPlots = await pool.query('SELECT COUNT(*) FROM plots');
  const soldPlots = await pool.query("SELECT COUNT(*) FROM plots WHERE status = 'sold'");
  const availablePlots = await pool.query("SELECT COUNT(*) FROM plots WHERE status = 'available'");
  const pendingPayments = await pool.query("SELECT COALESCE(SUM(amount - paid_amount), 0) total FROM installments WHERE status = 'pending'");
  const refunds = await pool.query('SELECT COUNT(*) count, COALESCE(SUM(refund_amount), 0) amount FROM refunds');
  const revenue = await pool.query("SELECT COALESCE(SUM(amount), 0) total FROM payments WHERE payment_date >= date_trunc('month', NOW())");

  res.json({
    totalPlots: Number(totalPlots.rows[0].count),
    soldPlots: Number(soldPlots.rows[0].count),
    availablePlots: Number(availablePlots.rows[0].count),
    pendingPayments: Number(pendingPayments.rows[0].total),
    refundCount: Number(refunds.rows[0].count),
    refundAmount: Number(refunds.rows[0].amount),
    monthlyRevenue: Number(revenue.rows[0].total),
  });
};

export const getRecentActivities = async (req: AuthRequest, res: Response) => {
  const result = await pool.query('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 20');
  res.json(result.rows);
};

export const getRevenueChart = async (req: AuthRequest, res: Response) => {
  // Use explicit AS aliases with double quotes - some PostgreSQL configurations
  // treat `month` as a reserved/typed keyword and reject it as a bare alias.
  const result = await pool.query(
    `SELECT to_char(date_trunc('month', payment_date), 'Mon YYYY') AS "month",
            SUM(amount) AS "revenue"
     FROM payments
     GROUP BY date_trunc('month', payment_date)
     ORDER BY date_trunc('month', payment_date) ASC
     LIMIT 12`,
  );
  res.json(result.rows);
};

export const getPlotStatus = async (req: AuthRequest, res: Response) => {
  const result = await pool.query('SELECT status, COUNT(*) count FROM plots GROUP BY status');
  res.json(result.rows);
};

// Per-colony summary used by the redesigned executive dashboard.
// When colonyId is omitted (or "all"), figures aggregate across every colony.
export const getColonyStats = async (req: AuthRequest, res: Response) => {
  const colonyId = (req.query.colonyId as string) || '';
  const isAll = !colonyId || colonyId === 'all';
  const colonyFilter = isAll ? '' : 'WHERE p.colony_id = $1';
  const params: any[] = isAll ? [] : [colonyId];

  // Plots breakdown
  const plotsBreakdown = await pool.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE status = 'sold')::int AS sold,
       COUNT(*) FILTER (WHERE status = 'available')::int AS available,
       COUNT(*) FILTER (WHERE status NOT IN ('sold', 'available'))::int AS other,
       COALESCE(SUM(total_price), 0)::numeric AS inventory_value
     FROM plots p
     ${colonyFilter}`,
    params,
  );

  // Receivable = pending installment balance for sales whose plot is in this colony.
  const receivable = await pool.query(
    `SELECT COALESCE(SUM(GREATEST(i.amount - COALESCE(i.paid_amount, 0), 0)), 0)::numeric AS total
     FROM installments i
     JOIN sales s ON s.id = i.sale_id
     JOIN plots p ON p.id = s.plot_id
     ${colonyFilter}
     ${colonyFilter ? 'AND' : 'WHERE'} i.status <> 'paid'`,
    params,
  );

  // Payable = refund_amount we owe customers (approved or pending, not yet refunded).
  const payable = await pool.query(
    `SELECT COALESCE(SUM(r.refund_amount - COALESCE(r.deduction_amount, 0)), 0)::numeric AS total
     FROM refunds r
     JOIN sales s ON s.id = r.sale_id
     JOIN plots p ON p.id = s.plot_id
     ${colonyFilter}
     ${colonyFilter ? 'AND' : 'WHERE'} r.approval_status IN ('pending', 'approved')
       AND r.refund_date IS NULL`,
    params,
  );

  // Cash collected = sum of payments received against sales of plots in this colony.
  const collected = await pool.query(
    `SELECT COALESCE(SUM(pay.amount), 0)::numeric AS total
     FROM payments pay
     JOIN sales s ON s.id = pay.sale_id
     JOIN plots p ON p.id = s.plot_id
     ${colonyFilter}`,
    params,
  );

  // Refunds actually disbursed (already paid out) reduce profit.
  const refundsPaid = await pool.query(
    `SELECT COALESCE(SUM(r.refund_amount - COALESCE(r.deduction_amount, 0)), 0)::numeric AS total
     FROM refunds r
     JOIN sales s ON s.id = r.sale_id
     JOIN plots p ON p.id = s.plot_id
     ${colonyFilter}
     ${colonyFilter ? 'AND' : 'WHERE'} r.refund_date IS NOT NULL`,
    params,
  );

  // Sales / customer counts for the colony.
  const salesCount = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM sales s
     JOIN plots p ON p.id = s.plot_id
     ${colonyFilter}`,
    params,
  );

  const customerCount = await pool.query(
    `SELECT COUNT(DISTINCT s.customer_id)::int AS total
     FROM sales s
     JOIN plots p ON p.id = s.plot_id
     ${colonyFilter}`,
    params,
  );

  // Monthly collection trend for the chart (last 6 months).
  const trend = await pool.query(
    `SELECT to_char(date_trunc('month', pay.payment_date), 'Mon YYYY') AS month,
            COALESCE(SUM(pay.amount), 0)::numeric AS revenue
     FROM payments pay
     JOIN sales s ON s.id = pay.sale_id
     JOIN plots p ON p.id = s.plot_id
     ${colonyFilter}
     ${colonyFilter ? 'AND' : 'WHERE'} pay.payment_date >= (NOW() - INTERVAL '6 months')
     GROUP BY date_trunc('month', pay.payment_date)
     ORDER BY date_trunc('month', pay.payment_date) ASC`,
    params,
  );

  // Plot status pie data.
  const statusBreakdown = await pool.query(
    `SELECT status, COUNT(*)::int AS count
     FROM plots p
     ${colonyFilter}
     GROUP BY status`,
    params,
  );

  const plots = plotsBreakdown.rows[0];
  const cashIn = Number(collected.rows[0].total);
  const refundsOut = Number(refundsPaid.rows[0].total);
  const profit = cashIn - refundsOut;

  // New features: Colony land details
  let landDetails = { total_land: 0, road_cut_land: 0, remaining_land: 0 };
  if (isAll) {
    const resLand = await pool.query(
      `SELECT 
         COALESCE(SUM(total_land), 0)::numeric AS total_land,
         COALESCE(SUM(road_cut_land), 0)::numeric AS road_cut_land,
         COALESCE(SUM(remaining_land), 0)::numeric AS remaining_land
       FROM colonies`
    );
    if (resLand.rows[0]) {
      landDetails = {
        total_land: Number(resLand.rows[0].total_land),
        road_cut_land: Number(resLand.rows[0].road_cut_land),
        remaining_land: Number(resLand.rows[0].remaining_land)
      };
    }
  } else {
    const resLand = await pool.query(
      `SELECT 
         COALESCE(total_land, 0)::numeric AS total_land,
         COALESCE(road_cut_land, 0)::numeric AS road_cut_land,
         COALESCE(remaining_land, 0)::numeric AS remaining_land
       FROM colonies WHERE id = $1`,
      [colonyId]
    );
    if (resLand.rows[0]) {
      landDetails = {
        total_land: Number(resLand.rows[0].total_land),
        road_cut_land: Number(resLand.rows[0].road_cut_land),
        remaining_land: Number(resLand.rows[0].remaining_land)
      };
    }
  }

  // Sold area in marlas
  const soldAreaRes = await pool.query(
    `SELECT COALESCE(SUM(plot_size), 0)::numeric AS total_sold_area 
     FROM plots p
     ${colonyFilter ? "WHERE p.colony_id = $1 AND p.status = 'sold'" : "WHERE p.status = 'sold'"}`,
    params
  );
  const totalSoldArea = Number(soldAreaRes.rows[0]?.total_sold_area || 0);

  // Remaining plots grouped by size
  const remainingPlotsBySizeRes = await pool.query(
    `SELECT COALESCE(plot_size, 0)::numeric AS size, COUNT(*)::int AS count 
     FROM plots p
     ${colonyFilter ? "WHERE p.colony_id = $1 AND p.status <> 'sold'" : "WHERE p.status <> 'sold'"}
     GROUP BY plot_size
     ORDER BY plot_size ASC`,
    params
  );
  const remainingPlotsBySize = remainingPlotsBySizeRes.rows.map(row => ({
    size: Number(row.size),
    count: Number(row.count)
  }));

  res.json({
    colonyId: isAll ? 'all' : colonyId,
    plots: {
      total: Number(plots.total),
      sold: Number(plots.sold),
      available: Number(plots.available),
      other: Number(plots.other),
      remaining: Number(plots.available) + Number(plots.other),
      inventoryValue: Number(plots.inventory_value),
    },
    landDetails,
    totalSoldArea,
    remainingPlotsBySize,
    sales: {
      count: Number(salesCount.rows[0].total),
      customers: Number(customerCount.rows[0].total),
    },
    receivable: Number(receivable.rows[0].total),
    payable: Number(payable.rows[0].total),
    cashCollected: cashIn,
    refundsPaid: refundsOut,
    profit,
    revenueTrend: trend.rows.map((row) => ({
      month: row.month,
      revenue: Number(row.revenue),
    })),
    plotStatus: statusBreakdown.rows.map((row) => ({
      status: row.status,
      count: Number(row.count),
    })),
  });
};

export const getUpcomingInstallments = async (req: AuthRequest, res: Response) => {
  try {
    const salesQuery = await pool.query(`
      SELECT s.id AS sale_id, s.sale_number, s.total_price,
             c.full_name AS customer_name,
             p.plot_number, col.name AS colony_name
      FROM sales s
      JOIN customers c ON s.customer_id = c.id
      JOIN plots p ON s.plot_id = p.id
      JOIN colonies col ON p.colony_id = col.id
      WHERE s.status = 'active'
    `);

    const upcomingList = [];

    for (const sale of salesQuery.rows) {
      const installmentsQuery = await pool.query(`
        SELECT id, installment_number, due_date, amount, paid_amount, status
        FROM installments
        WHERE sale_id = $1
        ORDER BY due_date ASC, installment_number ASC
      `, [sale.sale_id]);

      const installments = installmentsQuery.rows;
      if (installments.length === 0) continue;

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();

      const startOfCurrentMonth = new Date(currentYear, currentMonth, 1);

      let prevInstallment = null;
      let prevInstallmentRemaining = 0;
      let prevInstallmentTotal = 0;
      let currentMonthInstallmentTotal = 0;
      let previousOverdueUnpaidSum = 0;
      let hasUnpaidCurrentOrPast = false;

      const pastInstallments = installments.filter(inst => new Date(inst.due_date) < startOfCurrentMonth);
      if (pastInstallments.length > 0) {
        prevInstallment = pastInstallments[pastInstallments.length - 1];
        prevInstallmentTotal = parseFloat(prevInstallment.amount) || 0;
        prevInstallmentRemaining = prevInstallmentTotal - (parseFloat(prevInstallment.paid_amount) || 0);

        pastInstallments.forEach(inst => {
          if (inst.status !== 'paid') {
            previousOverdueUnpaidSum += ((parseFloat(inst.amount) || 0) - (parseFloat(inst.paid_amount) || 0));
            hasUnpaidCurrentOrPast = true;
          }
        });
      }

      const currentMonthInstallment = installments.find(inst => {
        const d = new Date(inst.due_date);
        return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
      });

      if (currentMonthInstallment) {
        currentMonthInstallmentTotal = parseFloat(currentMonthInstallment.amount) || 0;
        if (currentMonthInstallment.status !== 'paid') {
          hasUnpaidCurrentOrPast = true;
        }
      }

      if (!hasUnpaidCurrentOrPast) {
        continue;
      }

      const totalUpcomingPayment = currentMonthInstallmentTotal + previousOverdueUnpaidSum;

      upcomingList.push({
        customer_name: sale.customer_name,
        plot_number: sale.plot_number,
        colony_name: sale.colony_name,
        previous_installment_total: prevInstallmentTotal,
        previous_installment_remaining: prevInstallmentRemaining,
        current_installment_total: currentMonthInstallmentTotal,
        total_upcoming_payment: totalUpcomingPayment,
      });
    }

    res.json(upcomingList);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load upcoming installments' });
  }
};

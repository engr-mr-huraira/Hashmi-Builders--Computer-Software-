/**
 * Module schemas drive the generic ModulePage:
 *   - columns: which fields appear in the list table
 *   - fields: form fields (auto-rendered by RecordForm)
 *   - filters: optional quick-filter chips for the toolbar
 *   - allow: which row actions are available
 *
 * Field types: text | textarea | number | email | password | date | select | checkbox | remote-select
 *   remote-select: options loaded from another endpoint (e.g. customers, plots, colonies)
 */

const STATUS = (values) => ({ type: 'select', options: values.map((v) => ({ value: v, label: v })) })

export const SCHEMAS = {
  '/colonies': {
    label: 'Colony',
    pluralLabel: 'Colonies',
    endpoint: '/colonies',
    columns: ['name', 'code', 'location', 'total_land', 'remaining_land', 'status', 'purchase_amount', 'advance_paid', 'remaining_amount', 'created_at'],
    filters: { status: ['active', 'inactive', 'completed'] },
    fields: [
      { name: 'name', label: 'Colony Name', type: 'text', required: true },
      { name: 'code', label: 'Code', type: 'text', required: true, placeholder: 'e.g. HG-001' },
      { name: 'location', label: 'Location', type: 'text', required: true },
      { name: 'total_land', label: 'Total Land (Marlas)', type: 'number', step: '0.01', min: 0 },
      { name: 'road_cut_land', label: 'Road Cut Land (Marlas)', type: 'number', step: '0.01', min: 0 },
      { name: 'remaining_land', label: 'Remaining Land', type: 'computed', readOnly: true,
        compute: (vals) => {
          const total = parseFloat(vals.total_land || 0) || 0;
          const cut = parseFloat(vals.road_cut_land || 0) || 0;
          return (total - cut).toFixed(2);
        },
      },
      { name: 'description', label: 'Description', type: 'textarea' },
      // Acquisition
      { name: 'purchase_from', label: 'Purchased From (Client / Vendor)', type: 'text', placeholder: 'e.g. ABC Land Developers' },
      { name: 'purchase_amount', label: 'Purchase Amount', type: 'number', step: '0.01', placeholder: 'Total price paid to vendor' },
      { name: 'advance_paid', label: 'Advance Paid', type: 'number', step: '0.01', placeholder: 'Amount already paid' },
      { name: 'remaining_amount', label: 'Remaining', type: 'computed', readOnly: true,
        compute: (vals) => {
          const purchase = parseFloat(vals.purchase_amount || 0) || 0;
          const advance = parseFloat(vals.advance_paid || 0) || 0;
          return (purchase - advance).toFixed(2);
        },
      },
      { name: 'payment_plan_client', label: 'Payment Plan to Vendor', type: 'select',
        options: [
          { value: 'Quarterly', label: 'Quarterly' },
          { value: 'Yearly', label: 'Yearly' },
          { value: '6 Months', label: '6 Months' },
        ],
      },
      // File Uploads
      { name: 'bayan_file', label: 'Court k samny bayan', type: 'file' },
      { name: 'purchase_papers_file', label: 'Land Purchase Papers', type: 'file' },
      { name: 'stamp_paper_file', label: 'e Stam Paper', type: 'file' },
      { name: 'clearance_duration', label: 'Clearance Duration (Time to clear client)', type: 'text', placeholder: 'e.g. 1 Year, 6 Months' },
      { name: 'status', label: 'Status', type: 'text', readOnly: true, placeholder: 'Auto-managed (active / completed)' },
    ],
    allow: { create: true, update: true, delete: true, view: true },
  },

  '/plots': {
    label: 'Plot',
    pluralLabel: 'Plots',
    endpoint: '/plots',
    columns: ['plot_number', 'plot_size', 'plot_category', 'plot_type', 'total_price', 'status', 'created_at'],
    filters: { status: ['available', 'sold', 'cancelled'] },
    fields: [
      { name: 'colony_id', label: 'Colony', type: 'remote-select', endpoint: '/colonies', valueKey: 'id', labelKey: 'name', required: true,
        defaultValue: (() => {
          const val = localStorage.getItem('dashboard_selected_colony');
          return val && val !== 'all' ? val : '';
        })()
      },
      { name: 'plot_number', label: 'Plot Number', type: 'text', placeholder: 'Auto-generated' },
      { name: 'plot_size', label: 'Plot Size (Marla)', type: 'number', step: '0.01' },
      { name: 'plot_category', label: 'Category', type: 'select',
        options: [
          { value: 'Marla', label: 'Marla' },
          { value: 'Kanal', label: 'Kanal' },
        ],
        defaultValue: 'Marla',
      },
      { name: 'plot_type', label: 'Type', ...STATUS(['residential', 'commercial']) },
      { name: 'dimensions', label: 'Dimensions', type: 'text', placeholder: 'e.g. 25x45' },
      { name: 'price_per_marla', label: 'Price / Marla', type: 'number', step: '0.01' },
      { name: 'total_price', label: 'Total Price', type: 'number', step: '0.01', required: true,
        compute: (vals) => {
          const size = parseFloat(vals.plot_size || 0) || 0;
          const rate = parseFloat(vals.price_per_marla || 0) || 0;
          return (size * rate).toFixed(2);
        }
      },
      { name: 'is_corner', label: 'Corner Plot', type: 'checkbox' },
      { name: 'is_facing_park', label: 'Park Facing', type: 'checkbox' },
      { name: 'is_commercial', label: 'Commercial', type: 'checkbox' },
      { name: 'status', label: 'Status', ...STATUS(['available', 'sold', 'cancelled']), defaultValue: 'available' },
      { name: 'booking_date', label: 'Booking Date', type: 'date' },
    ],
    allow: { create: true, update: true, delete: true, view: true },
  },

  '/customers': {
    label: 'Customer',
    pluralLabel: 'Customers',
    endpoint: '/customers',
    columns: ['full_name', 'cnic', 'phone', 'city', 'occupation', 'created_at'],
    fields: [
      { name: 'full_name', label: 'Full Name', type: 'text', required: true },
      { name: 'cnic', label: 'CNIC', type: 'cnic', required: true, placeholder: '00000-0000000-0' },
      { name: 'phone', label: 'Phone', type: 'phone', required: true, defaultValue: '+92' },
      { name: 'secondary_phone', label: 'Secondary Phone', type: 'phone' },
      { name: 'email', label: 'Email', type: 'email', defaultValue: '@gmail.com' },
      { name: 'address', label: 'Address', type: 'textarea' },
      { name: 'city', label: 'City', type: 'text' },
      { name: 'province', label: 'Province', type: 'text', defaultValue: 'Punjab', readOnly: true },
      { name: 'occupation', label: 'Occupation', type: 'select',
        options: [
          { value: 'Business', label: 'Business' },
          { value: 'Salaried', label: 'Salaried' },
          { value: 'Doctor', label: 'Doctor' },
          { value: 'Engineer', label: 'Engineer' },
          { value: 'Teacher', label: 'Teacher' },
          { value: 'Retired', label: 'Retired' },
          { value: 'Farmer', label: 'Farmer' },
          { value: 'Housewife', label: 'Housewife' },
          { value: 'Other', label: 'Other' },
        ],
      },
    ],
    allow: { create: true, update: true, delete: true, view: true },
  },

  '/sales': {
    label: 'Sale',
    pluralLabel: 'Sales',
    endpoint: '/sales',
    columns: ['sale_number', 'sale_date', 'total_price', 'payment_plan', 'status', 'created_at'],
    filters: { status: ['active', 'completed', 'cancelled', 'transferred'] },
    fields: [
      { name: 'sale_number', label: 'Sale #', type: 'text', placeholder: 'Auto-generated' },
      { name: 'plot_id', label: 'Plot', type: 'remote-select', endpoint: '/plots', valueKey: 'id', labelKey: 'plot_number', required: true },
      { name: 'customer_id', label: 'Customer', type: 'remote-select', endpoint: '/customers', valueKey: 'id', labelKey: 'full_name', required: true },
      { name: 'sale_date', label: 'Sale Date', type: 'date', required: true, defaultToday: true },
      { name: 'total_price', label: 'Total Price', type: 'number', step: '0.01', required: true },
      { name: 'payment_plan', label: 'Payment Plan', type: 'select',
        options: [
          { value: '1 Month', label: '1 Month' },
          { value: '3 Months', label: '3 Months' },
          { value: '6 Months', label: '6 Months' },
          { value: '9 Months', label: '9 Months' },
          { value: 'Yearly', label: 'Yearly' },
        ],
      },
      { name: 'installment_months', label: 'Payment Clearance Period (Months)', type: 'number' },
      { name: 'monthly_installment', label: 'Monthly Installment', type: 'number', step: '0.01' },
      { name: 'down_payment', label: 'Down Payment', type: 'number', step: '0.01' },
      { name: 'remaining_payment', label: 'Remaining Payment', type: 'computed', readOnly: true,
        compute: (vals) => {
          const total = parseFloat(vals.total_price || 0) || 0;
          const down = parseFloat(vals.down_payment || 0) || 0;
          return (total - down).toFixed(2);
        }
      },
      { name: 'agreement_number', label: 'Agreement File', type: 'file' },
      { name: 'status', label: 'Status', ...STATUS(['active', 'completed', 'cancelled', 'transferred']), defaultValue: 'active' },
    ],
    allow: { create: true, update: true, delete: true, view: true },
  },

  '/payments': {
    label: 'Payment',
    pluralLabel: 'Payments',
    endpoint: '/payments',
    columns: ['payment_number', 'payment_date', 'amount', 'payment_method', 'created_at'],
    filters: { payment_method: ['cash', 'cheque', 'bank_transfer'] },
    fields: [
      { name: 'payment_number', label: 'Payment #', type: 'text', placeholder: 'Auto-generated' },
      { name: 'sale_id', label: 'Select Customer', type: 'remote-select', endpoint: '/sales', valueKey: 'id', labelKey: 'customer_name', required: true },
      { name: 'payment_date', label: 'Payment Date', type: 'date', required: true, defaultToday: true },
      { name: 'payment_method', label: 'Payment Method', type: 'select',
        options: [
          { value: 'cash', label: 'CASH' },
          { value: 'cheque', label: 'Cheque' },
          { value: 'bank_transfer', label: 'Bank Transfer' },
        ],
        required: true,
      },
      { name: 'amount', label: 'Enter Amount', type: 'number', step: '0.01', required: true,
        isVisible: (vals) => ['cash', 'cheque', 'bank_transfer'].includes(vals.payment_method),
      },
      { name: 'bank_name', label: 'Bank Name', type: 'text',
        isVisible: (vals) => vals.payment_method === 'cheque',
        required: true,
      },
      { name: 'cheque_number', label: 'Cheque Number', type: 'text',
        isVisible: (vals) => vals.payment_method === 'cheque',
        required: true,
      },
      { name: 'transaction_id', label: 'Upload the Bank Transfer Receipt', type: 'file',
        isVisible: (vals) => vals.payment_method === 'bank_transfer',
        required: true,
      },
    ],
    allow: { create: true, update: true, delete: true, view: true },
  },

  '/refunds': {
    label: 'Refund',
    pluralLabel: 'Refunds',
    endpoint: '/refunds',
    columns: ['refund_number', 'request_date', 'refund_amount', 'payment_method', 'approval_status', 'created_at'],
    filters: { approval_status: ['pending', 'approved', 'rejected'] },
    fields: [
      { name: 'refund_number', label: 'Refund #', type: 'text', required: true },
      { name: 'sale_id', label: 'Select Customer Name', type: 'remote-select', endpoint: '/sales', valueKey: 'id', labelKey: 'customer_name', required: true },
      { name: 'request_date', label: 'Request Date', type: 'date', required: true, defaultToday: true },
      { name: 'payment_method', label: 'Method', type: 'select',
        options: [
          { value: 'cash', label: 'CASH' },
          { value: 'cheque', label: 'Cheque' },
          { value: 'bank_transfer', label: 'Bank Transfer' },
        ],
        required: true,
      },
      { name: 'refund_amount', label: 'Refund Amount', type: 'number', step: '0.01', required: true,
        isVisible: (vals) => ['cash', 'cheque', 'bank_transfer'].includes(vals.payment_method),
      },
      { name: 'bank_name', label: 'Bank Name', type: 'text',
        isVisible: (vals) => vals.payment_method === 'cheque',
        required: true,
      },
      { name: 'cheque_number', label: 'Cheque Number', type: 'text',
        isVisible: (vals) => vals.payment_method === 'cheque',
        required: true,
      },
      { name: 'transaction_id', label: 'Upload the Bank Transfer Receipt', type: 'file',
        isVisible: (vals) => vals.payment_method === 'bank_transfer',
        required: true,
      },
    ],
    allow: { create: true, update: true, delete: false, view: true },
  },

  '/financial/transactions': {
    label: 'Transaction',
    pluralLabel: 'Financial Transactions',
    endpoint: '/financial/transactions',
    columns: ['transaction_type', 'category', 'amount', 'description', 'transaction_date'],
    filters: { transaction_type: ['income', 'expense'] },
    fields: [
      { name: 'transaction_type', label: 'Type', ...STATUS(['income', 'expense']), required: true },
      { name: 'colony_id', label: 'Select Colony', type: 'remote-select', endpoint: '/colonies', valueKey: 'id', labelKey: 'name',
        isVisible: (vals) => vals.transaction_type === 'expense',
        defaultValue: (() => {
          const val = localStorage.getItem('dashboard_selected_colony');
          return val && val !== 'all' ? val : '';
        })()
      },
      { name: 'category', label: 'Category', type: 'text', required: true,
        isVisible: (vals) => vals.transaction_type !== 'expense',
      },
      { name: 'category', label: 'Expense Type', type: 'select',
        options: [
          { value: 'Road Expenses', label: 'Road Expenses' },
          { value: 'Sewerage Expense', label: 'Sewerage Expense' },
          { value: 'Others', label: 'Others' },
        ],
        required: true,
        isVisible: (vals) => vals.transaction_type === 'expense',
      },
      { name: 'amount', label: 'Amount', type: 'number', step: '0.01', required: true },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'transaction_date', label: 'Date', type: 'date', required: true, defaultToday: true },
    ],
    allow: { create: true, update: false, delete: false, view: true },
  },

  '/documents': {
    label: 'Document',
    pluralLabel: 'Documents',
    endpoint: '/documents',
    columns: ['document_name', 'document_type', 'entity_type', 'file_type', 'created_at'],
    fields: [
      { name: 'document_name', label: 'Document Name', type: 'text', required: true },
      { name: 'document_type', label: 'Document Type', type: 'text', required: true, placeholder: 'agreement / NOC / registry / ID' },
      { name: 'entity_type', label: 'Linked To', ...STATUS(['customer', 'plot', 'sale', 'payment']) },
      { name: 'entity_id', label: 'Linked Entity ID', type: 'text' },
      { name: 'file_path', label: 'File Path / URL', type: 'text' },
      { name: 'file_type', label: 'File Type', type: 'text', placeholder: 'pdf, jpg, docx...' },
    ],
    allow: { create: true, update: false, delete: true, view: true },
  },

  '/reports/sales': {
    label: 'Report',
    pluralLabel: 'Reports',
    endpoint: '/reports/sales',
    columns: ['sale_number', 'sale_date', 'total_price', 'status'],
    fields: [],
    allow: { create: false, update: false, delete: false, view: true },
    readOnly: true,
  },

  '/notifications': {
    label: 'Notification',
    pluralLabel: 'Notifications',
    endpoint: '/notifications',
    columns: ['title', 'message', 'type', 'is_read', 'created_at'],
    fields: [],
    allow: { create: false, update: false, delete: true, view: true },
    readOnly: true,
  },

  '/users': {
    label: 'User',
    pluralLabel: 'Users & Roles',
    endpoint: '/users',
    columns: ['username', 'full_name', 'email', 'phone', 'is_active', 'created_at'],
    filters: { is_active: ['true', 'false'] },
    fields: [
      { name: 'username', label: 'Username', type: 'text', required: true },
      { name: 'full_name', label: 'Full Name', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'phone', label: 'Phone', type: 'text' },
      { name: 'role_id', label: 'Role', type: 'remote-select', endpoint: '/users/roles/all', valueKey: 'id', labelKey: 'name', required: true },
      { name: 'password', label: 'Password', type: 'password', createOnly: true, required: true, minLength: 6 },
      { name: 'is_active', label: 'Active', type: 'checkbox' },
    ],
    allow: { create: true, update: true, delete: true, view: true },
  },
}

export function schemaFor(endpoint) {
  return SCHEMAS[endpoint] || null
}

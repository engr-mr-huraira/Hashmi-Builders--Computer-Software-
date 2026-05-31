import { createRecord, deleteRecord, getRecord, listRecords, updateRecord } from './crudFactory';

const fields = ['full_name', 'cnic', 'phone', 'secondary_phone', 'email', 'address', 'city', 'province', 'occupation', 'nominee_name', 'nominee_cnic', 'nominee_relation', 'notes', 'created_by'];

export const getAllCustomers = listRecords('customers');
export const getCustomerById = getRecord('customers');
export const createCustomer = createRecord('customers', fields);
export const updateCustomer = updateRecord('customers', fields);
export const deleteCustomer = deleteRecord('customers');

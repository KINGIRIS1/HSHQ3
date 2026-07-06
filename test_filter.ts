import { supabase } from './services/supabaseClient';

async function testFilter() {
  const { data: users, error: userError } = await supabase.from('users').select('*');
  const { data: employees, error: empError } = await supabase.from('employees').select('*');

  if (userError || empError) {
    console.error("Error fetching:", { userError, empError });
    return;
  }

  console.log("\n--- Employees with 'giám đốc' or in 'Ban Giám đốc' ---");
  employees?.forEach(e => {
    const pos = (e.position || '').toLowerCase();
    const dept = (e.department || '').toLowerCase();
    if (pos.includes('doc') || pos.includes('lãnh') || dept.includes('giám') || dept.includes('lãnh')) {
      console.log(`Employee ID: '${e.id}' | Name: '${e.name}' | Position: '${e.position}' | Department: '${e.department}'`);
    }
  });

  console.log("\n--- Users linked to these employee IDs ---");
  users?.forEach(u => {
    if (u.employeeId && (u.employeeId.includes('02') || u.employeeId.includes('21') || u.employeeId.includes('22') || u.employeeId.includes('23'))) {
      console.log(`User: '${u.username}' | EmployeeId: '${u.employeeId}' | Name: '${u.name}'`);
    }
  });
}

testFilter();

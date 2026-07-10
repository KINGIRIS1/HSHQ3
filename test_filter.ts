import { supabase } from './services/supabaseClient';

async function testFilter() {
  const testId = 'test_' + Math.random().toString(36).substr(2, 9);
  const payload = {
    id: testId,
    code: 'TEST_' + Math.floor(Math.random() * 10000),
    customerName: 'Test Name',
    customerAddress: 'Test Address',
    issueNumber: 'TEST_ISSUE',
    entryNumber: 'TEST_ENTRY',
    residentialArea: 100,
    area: 200,
    recordType: '3.7 Cấp Lại',
    receivedDate: new Date().toISOString()
  };

  const { data, error } = await supabase.from('land_records').insert([payload]).select();
  if (error) {
    console.error("Insert error:", error);
  } else {
    console.log("Insert success! Inserted:", data);
    // Cleanup
    await supabase.from('land_records').delete().eq('id', testId);
    console.log("Cleanup success.");
  }
}

testFilter();

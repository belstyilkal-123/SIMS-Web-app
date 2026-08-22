const fs = require('fs');
let c = fs.readFileSync('frontend/src/pages/farmer/LabourAttachments.jsx', 'utf8');

if (!c.includes('showAttendanceModal')) {
  // Insert state
  c = c.replace(
    "const [assignUserId, setAssignUserId]       = useState('');",
    "const [assignUserId, setAssignUserId]       = useState('');\n  const [showAttendanceModal, setShowAttendanceModal] = useState(false);\n  const [attForm, setAttForm] = useState({ userId: '', date: new Date().toISOString().slice(0,10), status: 'present', checkIn: '', checkOut: '' });\n  const [attSaving, setAttSaving] = useState(false);"
  );

  // Insert button
  c = c.replace(
    '<button className="fp-btn fp-btn-primary" onClick={handleOpenAssign}>',
    '<button className="fp-btn fp-btn-primary" style={{ marginRight: 10 }} onClick={() => setShowAttendanceModal(true)}>\n              + Mark Attendance\n            </button>\n            <button className="fp-btn fp-btn-primary" onClick={handleOpenAssign}>'
  );

  // Insert submit handler
  c = c.replace(
    "const submitAssign = async (e) => {",
    "const submitAttendance = async (e) => {\n    e.preventDefault();\n    if (!selectedFarm || !attForm.userId) return;\n    setAttSaving(true);\n    try {\n      const payload = { ...attForm, farmId: selectedFarm };\n      if (payload.checkIn) payload.checkIn = payload.date + 'T' + payload.checkIn;\n      if (payload.checkOut) payload.checkOut = payload.date + 'T' + payload.checkOut;\n      await axios.post(API_URL + '/api/attendance', payload, cfg);\n      setShowAttendanceModal(false);\n      loadData();\n    } catch (err) {\n      alert(err?.response?.data?.error || 'Failed to mark attendance');\n    } finally {\n      setAttSaving(false);\n    }\n  };\n\n  const submitAssign = async (e) => {"
  );

  // Insert modal UI
  const modalUI = 
      {showAttendanceModal && (
        <div className="fp-modal-backdrop" onClick={() => setShowAttendanceModal(false)} style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:999 }}>
          <div className="fp-modal-content" onClick={e => e.stopPropagation()} style={{ background:'var(--bg)', padding:24, borderRadius:12, width:'100%', maxWidth:400 }}>
            <h3 style={{ margin:'0 0 16px 0' }}>Mark Attendance</h3>
            <form onSubmit={submitAttendance}>
              <div style={{ marginBottom:12 }}>
                <label style={{ display:'block', marginBottom:4, fontSize:'0.9rem' }}>Worker</label>
                <select required value={attForm.userId} onChange={e => setAttForm({...attForm, userId: e.target.value})} style={{ width:'100%', padding:'8px' }}>
                  <option value="">Select worker...</option>
                  {labourUsers.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom:12 }}>
                <label style={{ display:'block', marginBottom:4, fontSize:'0.9rem' }}>Date</label>
                <input required type="date" value={attForm.date} onChange={e => setAttForm({...attForm, date: e.target.value})} style={{ width:'100%', padding:'8px' }} />
              </div>
              <div style={{ marginBottom:12 }}>
                <label style={{ display:'block', marginBottom:4, fontSize:'0.9rem' }}>Status</label>
                <select value={attForm.status} onChange={e => setAttForm({...attForm, status: e.target.value})} style={{ width:'100%', padding:'8px' }}>
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="late">Late</option>
                  <option value="half_day">Half Day</option>
                </select>
              </div>
              <div style={{ display:'flex', gap:10, marginBottom:16 }}>
                <div style={{ flex:1 }}>
                  <label style={{ display:'block', marginBottom:4, fontSize:'0.9rem' }}>Check In</label>
                  <input type="time" value={attForm.checkIn} onChange={e => setAttForm({...attForm, checkIn: e.target.value})} style={{ width:'100%', padding:'8px' }} />
                </div>
                <div style={{ flex:1 }}>
                  <label style={{ display:'block', marginBottom:4, fontSize:'0.9rem' }}>Check Out</label>
                  <input type="time" value={attForm.checkOut} onChange={e => setAttForm({...attForm, checkOut: e.target.value})} style={{ width:'100%', padding:'8px' }} />
                </div>
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button type="submit" disabled={attSaving || !attForm.userId} style={{ flex:1, padding:10, borderRadius:8, border:'none', background:'linear-gradient(135deg,#16a34a,#15803d)', color:'white', fontWeight:600, cursor:'pointer' }}>
                  {attSaving ? 'Saving...' : 'Save'}
                </button>
                <button type="button" onClick={() => setShowAttendanceModal(false)} style={{ flex:1, padding:10, borderRadius:8, border:'none', background:'#f1f5f9', color:'#475569', fontWeight:600, cursor:'pointer' }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
  ;
  c = c.replace(
    "{/* Assign Modal */}",
    modalUI + "\n      {/* Assign Modal */}"
  );
  
  fs.writeFileSync('frontend/src/pages/farmer/LabourAttachments.jsx', c);
  console.log("Success");
}

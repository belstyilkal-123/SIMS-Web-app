import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';
import { API_URL } from '../../config/api';

export default function PendingApprovals() {
  const { user } = useContext(AuthContext);
  const cfg = { headers: { Authorization: `Bearer ${user.token}` } };

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState(null);

  const loadRequests = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/assignment-requests`, cfg);
      setRequests(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRequests(); }, []);

  const handleAction = async (id, action) => {
    setActioning(id);
    try {
      await axios.post(`${API_URL}/api/assignment-requests/${id}/${action}`, {}, cfg);
      loadRequests();
    } catch (err) {
      alert('Action failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setActioning(null);
    }
  };

  if (loading) return <div style={{ padding: 20 }}>Loading Approvals...</div>;

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 8, color: '#111827' }}>Pending Approvals</h2>
      <p style={{ color: '#4b5563', marginBottom: 24 }}>Review farm and labour assignments requested by the Farmer.</p>

      {requests.length === 0 ? (
        <div style={{ padding: 40, background: '#f9fafb', borderRadius: 12, textAlign: 'center', color: '#6b7280' }}>
          No pending approvals at this time.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {requests.map(req => (
            <div key={req._id} style={{ padding: 20, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ display: 'inline-block', padding: '4px 8px', background: '#dbeafe', color: '#1d4ed8', borderRadius: 4, fontSize: '0.8rem', fontWeight: 600, marginBottom: 8 }}>
                  FARM ASSIGNMENT
                </span>
                <div style={{ fontSize: '1.1rem', color: '#111827', marginBottom: 4 }}>
                  <strong>{req.targetUserId?.name || 'Unknown User'}</strong> &rarr; <strong>{req.farmId?.name || 'Unknown Farm'}</strong>
                </div>
                <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>
                  Requested by: {req.requestedBy?.name || 'Office Manager'} • {new Date(req.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button 
                  onClick={() => handleAction(req._id, 'approve')}
                  disabled={actioning === req._id}
                  style={{ padding: '8px 16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>
                  {actioning === req._id ? '...' : 'Approve'}
                </button>
                <button 
                  onClick={() => handleAction(req._id, 'reject')}
                  disabled={actioning === req._id}
                  style={{ padding: '8px 16px', background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

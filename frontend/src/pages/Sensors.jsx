import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config/api';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

// Mock data for charts
const mockChartData = [
  { time: '08:00', moisture: 42, temp: 22, humidity: 65 },
  { time: '09:00', moisture: 41, temp: 23, humidity: 63 },
  { time: '10:00', moisture: 39, temp: 25, humidity: 60 },
  { time: '11:00', moisture: 37, temp: 27, humidity: 55 },
  { time: '12:00', moisture: 35, temp: 29, humidity: 50 },
  { time: '13:00', moisture: 32, temp: 30, humidity: 48 },
  { time: '14:00', moisture: 30, temp: 31, humidity: 45 },
  // Assume pump turns on at 14:00
  { time: '15:00', moisture: 65, temp: 29, humidity: 50 },
  { time: '16:00', moisture: 63, temp: 27, humidity: 55 },
];

const Sensors = () => {
  const [sensors, setSensors] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const fetchSensors = async () => {
      try {
        const config = { headers: { Authorization: `Bearer ${user.token}` } };
        // Assuming we are fetching sensors for a specific device, for now fetch all
        const response = await axios.get(`${API_URL}/api/sensors`, config);
        setSensors(response.data);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching sensors:", error);
        setLoading(false);
      }
    };
    fetchSensors();
  }, [user, navigate]);

  if (loading) return <div className="container text-center mt-8">Loading sensors...</div>;

  return (
    <div className="container">
      <div className="flex justify-between items-center mb-8">
        <h1 style={{ fontSize: '2.5rem', color: 'var(--primary)' }}>Sensor Monitoring</h1>
        <button className="btn btn-primary">+ Add Sensor</button>
      </div>

      <div className="glass-card mb-8">
        <h3 className="form-label mb-4">Live Trends (Today)</h3>
        <div style={{ width: '100%', height: 400 }}>
          <ResponsiveContainer>
            <LineChart data={mockChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="time" stroke="var(--text-muted)" />
              <YAxis stroke="var(--text-muted)" />
              <Tooltip 
                contentStyle={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }} 
              />
              <Legend />
              <Line type="monotone" dataKey="moisture" stroke="var(--primary)" strokeWidth={3} name="Moisture (%)" />
              <Line type="monotone" dataKey="temp" stroke="var(--accent)" strokeWidth={3} name="Temperature (°C)" />
              <Line type="monotone" dataKey="humidity" stroke="var(--secondary)" strokeWidth={3} name="Humidity (%)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Active Sensors</h2>
      <div className="grid-dashboard">
        {sensors.length === 0 ? (
          <p className="text-muted">No sensors active.</p>
        ) : (
          sensors.map(sensor => (
            <div key={sensor._id} className="glass-card flex justify-between items-center">
              <div>
                <h4 style={{ fontSize: '1.1rem' }}>{sensor.name || sensor.type}</h4>
                <p className="text-muted text-sm capitalize">Type: {sensor.type.replace('_', ' ')}</p>
              </div>
              <span className={`status-indicator ${sensor.status === 'active' ? 'status-online' : 'status-offline'}`}></span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Sensors;

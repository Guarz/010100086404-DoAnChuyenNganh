import { useState, useEffect } from 'react';
import axios from 'axios';

const RagAnalyticsDashboard = () => {
  const [metrics, setMetrics] = useState({ totalEvaluated: 0, avgHitRate: 0, avgRecall: 0 });
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEvaluating, setIsEvaluating] = useState(false);

  // 1. HÀM PURE FETCH: Chỉ làm nhiệm vụ gọi API trả về data, TUYỆT ĐỐI KHÔNG chứa setState
  const fetchAnalyticsData = async () => {
    const token = localStorage.getItem('token');
    const res = await axios.get('http://localhost:5000/api/admin/rag-analytics', {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.data;
  };

  // 2. USEEFFECT: Chỉ gọi setState SAU KHI đã await (đảm bảo tính bất đồng bộ 100%)
  useEffect(() => {
    let isMounted = true; // Kỹ thuật chống memory leak
    
    const loadInitialData = async () => {
      try {
        const result = await fetchAnalyticsData();
        if (isMounted && result.success) {
          setMetrics(result.data.metrics);
          setLogs(result.data.recentLogs);
        }
      } catch (error) {
        console.error('Lỗi tải RAG Analytics:', error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadInitialData();

    return () => { isMounted = false; };
  }, []); // Dependency rỗng, không còn cảnh báo ESLint

  // 3. HÀM XỬ LÝ NÚT BẤM: Tự quản lý state loading riêng
  const handleTriggerEvaluation = async () => {
    try {
      setIsEvaluating(true);
      const token = localStorage.getItem('token');
      const res = await axios.post('http://localhost:5000/api/admin/rag/evaluate', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(res.data.message);
      
      // Tải lại dữ liệu mới sau khi AI chấm điểm xong
      setIsLoading(true);
      const newData = await fetchAnalyticsData();
      if (newData.success) {
        setMetrics(newData.data.metrics);
        setLogs(newData.data.recentLogs);
      }
    } catch (error) {
      console.error('Lỗi chấm điểm:', error);
      alert('Có lỗi xảy ra khi gọi AI giám khảo.');
    } finally {
      setIsLoading(false);
      setIsEvaluating(false);
    }
  };

  if (isLoading) return <div className="p-5 text-center text-gray-500 font-medium">Đang tải dữ liệu RAG...</div>;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">RAG AI Analytics</h1>
        <button 
          onClick={handleTriggerEvaluation}
          disabled={isEvaluating}
          className={`px-4 py-2 text-white font-medium rounded shadow transition-colors ${isEvaluating ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {isEvaluating ? ' Đang chấm điểm...' : ' Kích hoạt AI chấm điểm'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
          <p className="text-sm text-gray-500 font-semibold uppercase tracking-wider">Mẫu đã gán nhãn (Golden)</p>
          <p className="text-3xl font-bold text-gray-800 mt-2">{metrics.totalEvaluated}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
          <p className="text-sm text-gray-500 font-semibold uppercase tracking-wider">Hit Rate (Tỉ lệ trúng)</p>
          <p className="text-3xl font-bold text-green-600 mt-2">{metrics.avgHitRate}%</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-purple-500">
          <p className="text-sm text-gray-500 font-semibold uppercase tracking-wider">Recall Trung bình</p>
          <p className="text-3xl font-bold text-purple-600 mt-2">{metrics.avgRecall}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-100 text-gray-600 uppercase text-xs font-semibold">
            <tr>
              <th className="px-6 py-4 border-b">Thời gian</th>
              <th className="px-6 py-4 border-b w-1/3">Truy vấn của Khách</th>
              <th className="px-6 py-4 border-b w-1/3">AI Trả lời</th>
              <th className="px-6 py-4 border-b text-center">Groundedness</th>
            </tr>
          </thead>
          <tbody className="text-sm text-gray-700 divide-y divide-gray-200">
            {logs.map((log) => (
              <tr key={log._id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                  {new Date(log.createdAt).toLocaleString('vi-VN')}
                </td>
                <td className="px-6 py-4 font-medium text-gray-900">{log.userQuery}</td>
                <td className="px-6 py-4 text-gray-600 truncate max-w-xs" title={log.llmResponse}>
                  {log.llmResponse}
                </td>
                <td className="px-6 py-4 text-center">
                  {log.metrics?.groundedness !== null ? (
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${log.metrics.groundedness === 1 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {log.metrics.groundedness === 1 ? 'Pass' : 'Fail'}
                    </span>
                  ) : (
                    <span className="text-gray-400 italic text-xs">Chưa chấm</span>
                  )}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                  Hệ thống chưa ghi nhận truy vấn RAG nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RagAnalyticsDashboard;
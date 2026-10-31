import { useState, useEffect } from 'react';
import API from '../services/api';

const RagAnalyticsDashboard = () => {
  const [metrics, setMetrics] = useState({ totalEvaluated: 0, avgHitRate: 0, avgRecall: 0 });
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEvaluating, setIsEvaluating] = useState(false);

  // 1. HÀM PURE FETCH: Chỉ làm nhiệm vụ gọi API trả về data, TUYỆT ĐỐI KHÔNG chứa setState
  const fetchAnalyticsData = async () => {
    const res = await API.get('/admin/rag-analytics');
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
      const res = await API.post('/admin/rag/evaluate');
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
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-800">RAG AI Analytics</h1>
        <button 
          onClick={handleTriggerEvaluation}
          disabled={isEvaluating}
          className={`px-4 py-2 text-white font-medium rounded shadow transition-colors ${isEvaluating ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {isEvaluating ? ' Đang chấm điểm...' : ' Kích hoạt AI chấm điểm'}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {[
          ['Mẫu đã gán nhãn (Golden)', metrics.totalEvaluated, 'border-blue-500 text-gray-800'],
          [`Hit Rate@${metrics.k || 5}`, `${metrics.avgHitRate}%`, 'border-green-500 text-green-600'],
          [`Recall@${metrics.k || 5}`, metrics.avgRecall, 'border-purple-500 text-purple-600'],
          [`Precision@${metrics.k || 5}`, metrics.avgPrecision ?? 0, 'border-indigo-500 text-indigo-600'],
          [`nDCG@${metrics.k || 5}`, metrics.avgNdcg ?? 0, 'border-teal-500 text-teal-600'],
          ['MRR', metrics.mrr ?? 0, 'border-cyan-500 text-cyan-600'],
          ['Citation correctness', metrics.citationCorrectness == null ? '—' : `${metrics.citationCorrectness}%`, 'border-amber-500 text-amber-600'],
          ['Groundedness (Pass)', metrics.groundednessPassRate == null ? '—' : `${metrics.groundednessPassRate}%`, 'border-rose-500 text-rose-600'],
        ].map(([label, value, color]) => (
          <div key={label} className={`bg-white p-5 rounded-lg shadow border-l-4 ${color.split(' ')[0]}`}>
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">{label}</p>
            <p className={`text-2xl font-bold mt-2 ${color.split(' ')[1]}`}>{value}</p>
          </div>
        ))}
      </div>
      <p className="mb-8 text-sm text-gray-500">
        Nguồn câu trả lời:{' '}
        {Object.entries(metrics.answerSources || {}).map(([source, count]) => `${source}: ${count}`).join(' · ') || '—'}
        {metrics.avgLatencyMs != null && ` · Độ trễ trung bình: ${(metrics.avgLatencyMs / 1000).toFixed(1)}s`}
      </p>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow">
        <table className="w-full min-w-[720px] border-collapse text-left">
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
// File: src/components/AIChatWidget.jsx
import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import Icon from "./Icon";
import API from "../services/api"; // Import Axios instance vừa tạo

const formatMoney = (n) => `${Math.round(n / 1000).toLocaleString("vi-VN")}k`;

const describeConstraints = (c) =>
  [
    c.city,
    c.checkIn && `${c.checkIn} → ${c.checkOut}`,
    c.adults && `${c.adults} người lớn`,
    c.children && `${c.children} trẻ em`,
    c.rooms && `${c.rooms} phòng`,
    c.minPrice && `≥ ${formatMoney(c.minPrice)}/đêm`,
    c.maxPrice && `≤ ${formatMoney(c.maxPrice)}/đêm`,
    ...(c.amenities || []),
    ...(c.roomKinds || []),
    c.sortByPrice === "asc" && "Giá thấp nhất",
    c.sortByPrice === "desc" && "Giá cao nhất",
  ].filter(Boolean);

export default function AIChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Khởi tạo lịch sử chat với lời chào mặc định
  const [messages, setMessages] = useState([
    { 
      sender: "ai", 
      text: "Xin chào! Bạn đang muốn tìm một chỗ nghỉ ngơi như thế nào? (VD: Yên tĩnh, gần biển, phong cách cổ kính...)" 
    }
  ]);

  const messagesEndRef = useRef(null);

  // Tự động cuộn xuống tin nhắn mới nhất
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!query.trim() || loading) return;

    const userText = query.trim();
    setQuery("");
    
    // 1. Thêm câu hỏi của người dùng vào giao diện ngay lập tức
    setMessages((prev) => [...prev, { sender: "user", text: userText }]);
    setLoading(true);

    try {
      // 2. Gọi API Backend RAG (/api/ai/search)
      const response = await API.post("/ai/search", { query: userText });
      
      if (response.data.success) {
        const aiAnswer = response.data.answer;
        const recommendedRooms = response.data.rooms || [];

        // 3. Thêm câu trả lời của AI vào giao diện (kèm ràng buộc hệ thống đã hiểu)
        setMessages((prev) => [
          ...prev,
          {
            sender: "ai",
            text: aiAnswer,
            rooms: recommendedRooms,
            constraints: response.data.constraints,
          },
        ]);
      } else {
        setMessages((prev) => [...prev, { sender: "ai", text: "Xin lỗi, hệ thống đang gặp chút gián đoạn." }]);
      }
    } catch (error) {
      console.error("Lỗi gọi AI Chat:", error);
      setMessages((prev) => [...prev, { sender: "ai", text: "Không thể kết nối tới máy chủ AI. Hãy đảm bảo Backend (cổng 5000) đang chạy nhé!" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Box Chat */}
      {isOpen && (
        <div className="mb-4 w-[400px] overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl transition-all flex flex-col">
          {/* Header Box */}
          <div className="flex items-center justify-between bg-[#173b31] p-4 text-white">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-full bg-white/20"><Icon name="sparkle" size={16} /></span>
              <div>
                <h3 className="font-bold">Trợ lý AI Nestly</h3>
                <p className="text-[11px] text-white/70">Tìm khách sạn thông minh bằng RAG</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="rounded-full p-1 hover:bg-white/20">✕</button>
          </div>

          {/* Body Lịch sử Chat */}
          <div className="h-[420px] overflow-y-auto bg-stone-50 p-4 space-y-4">
            {messages.map((msg, index) => (
              <div key={index} className={`flex gap-3 ${msg.sender === "user" ? "flex-row-reverse" : ""}`}>
                {msg.sender === "ai" && (
                  <div className="grid size-8 shrink-0 place-items-center rounded-full bg-[#e8f2ed] text-[#173b31]">
                    <Icon name="sparkle" size={14} />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-2xl p-3.5 text-sm shadow-sm ${
                  msg.sender === "user" 
                    ? "bg-[#173b31] text-white rounded-tr-none" 
                    : "bg-white text-stone-700 rounded-tl-none border border-stone-100"
                }`}>
                  <p className="leading-relaxed whitespace-pre-line">{msg.text}</p>
                  
                  {/* Ràng buộc cứng hệ thống đã tách được từ câu hỏi */}
                  {msg.constraints && describeConstraints(msg.constraints).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {describeConstraints(msg.constraints).map((label) => (
                        <span key={label} className="rounded-full bg-[#e8f2ed] px-2 py-0.5 text-[10px] font-bold text-[#173b31]">
                          {label}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Hạng phòng gợi ý (đã lọc theo ràng buộc + quỹ phòng), số [n] khớp trích dẫn trong câu trả lời */}
                  {msg.rooms && msg.rooms.length > 0 && (
                    <div className="mt-3 space-y-2 border-t border-stone-100 pt-3">
                      <p className="text-xs font-bold text-[#b7812d]">Gợi ý từ hệ thống:</p>
                      {msg.rooms.map((r) => (
                        <Link
                          key={r.roomId}
                          to={`/hotels/${r.hotelId}`}
                          onClick={() => setIsOpen(false)}
                          className="block rounded-xl border border-stone-100 bg-stone-50 p-2.5 text-xs transition hover:border-[#173b31]/30"
                        >
                          <p className="font-bold text-[#173b31]">[{r.citation}] {r.title}</p>
                          <p className="text-stone-500">
                            {r.hotelName} · {r.city} · {Math.round(r.pricePerNight).toLocaleString("vi-VN")}đ/đêm
                            {r.availableRooms !== null && ` · còn ${r.availableRooms} phòng`}
                          </p>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {loading && (
              <div className="flex gap-3">
                <div className="grid size-8 shrink-0 place-items-center rounded-full bg-[#e8f2ed] text-[#173b31]">
                  <Icon name="sparkle" size={14} />
                </div>
                <div className="rounded-2xl rounded-tl-none bg-white p-3 text-sm text-stone-400 shadow-sm animate-pulse">
                  Trợ lý đang tìm kiếm khách sạn phù hợp...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Box Nhập liệu */}
          <div className="border-t border-stone-200 bg-white p-3">
            <form className="flex items-center gap-2" onSubmit={handleSendMessage}>
              <input 
                type="text" 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nhập yêu cầu tìm kiếm..." 
                disabled={loading}
                className="flex-1 rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm outline-none transition focus:border-[#173b31]"
              />
              <button type="submit" disabled={loading} className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#173b31] text-white hover:bg-[#245a4b] disabled:opacity-50">
                <Icon name="arrow" size={18} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Nút Float Mở Chat */}
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          className="group flex h-14 w-14 items-center justify-center rounded-full bg-[#173b31] text-white shadow-lg transition-all hover:w-[160px] hover:justify-start hover:px-4"
        >
          <Icon name="sparkle" size={24} className="shrink-0" />
          <span className="ml-2 w-0 overflow-hidden whitespace-nowrap text-sm font-bold opacity-0 transition-all group-hover:w-auto group-hover:opacity-100">
            Nhờ AI Tư Vấn
          </span>
        </button>
      )}
    </div>
  );
}
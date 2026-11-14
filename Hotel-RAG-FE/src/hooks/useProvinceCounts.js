// File: src/hooks/useProvinceCounts.js
// Lấy số khách sạn / số tuyến xe theo tỉnh để hiện bên cạnh tên tỉnh trong ô chọn.
//   useProvinceCounts("/hotels/provinces", "hotelCount")    -> { "Đà Nẵng": 8, ... }
//   useProvinceCounts("/transfers/provinces", "routeCount")
import { useEffect, useState } from "react";
import API from "../services/api";

export default function useProvinceCounts(url, field) {
  const [counts, setCounts] = useState({});
  useEffect(() => {
    API.get(url)
      .then((res) => setCounts(Object.fromEntries(res.data.data.map((p) => [p.name, p[field]]))))
      .catch(() => setCounts({})); // lỗi mạng -> vẫn hiện đủ 63 tỉnh, chỉ thiếu số đếm
  }, [url, field]);
  return counts;
}

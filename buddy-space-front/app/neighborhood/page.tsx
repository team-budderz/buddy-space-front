// app/neighborhood/page.tsx

"use client";

import React, { useState } from "react";

export default function NeighborhoodPage() {
  const [address, setAddress] = useState<string | null>(null);

  const handleLocationAuth = () => {
    if (!navigator.geolocation) {
      alert("이 브라우저는 위치 정보 API를 지원하지 않습니다.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        const accessToken = localStorage.getItem("accessToken");

        try {
          const response = await fetch("http://localhost:8080/api/neighborhoods", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              latitude,
              longitude,
            }),
          });

          if (!response.ok) {
            throw new Error("서버 응답 오류: " + response.status);
          }

        const json = await response.json();
        console.log("응답 전체:", json);

        if (!json?.result) {
          throw new Error("서버 응답에 data가 없습니다.");
        }

        const neighborhood = json.result;
        setAddress(neighborhood.address);
        alert(`동네 인증 완료: ${neighborhood.address}`);
        } catch (err) {
          console.error("동네 인증 실패", err);
          alert("동네 인증에 실패했습니다.");
        }
      },
      (err) => {
        console.error("위치 권한 거부됨", err);
        alert("위치 권한을 허용해주세요.");
      }
    );
  };

  return (
    <div>
      <h1>동네 인증</h1>
      <button onClick={handleLocationAuth}>📍 동네 인증하기</button>
      {address && <p>인증된 동네: {address}</p>}
    </div>
  );
}

// next.config.js
module.exports = {
  async rewrites() {
    return [
      // 구글 로그인 시작 엔드포인트
      {
        source: "/oauth2/authorization/:provider",
        destination: "http://localhost:8080/oauth2/authorization/:provider",
      },
      // <-- 이 줄을 추가 -->
      {
        source: "/login/oauth2/code/:provider",
        destination: "http://localhost:8080/login/oauth2/code/:provider",
      },
      // API 호출도 함께 포워딩
      {
        source: "/api/:path*",
        destination: "http://localhost:8080/api/:path*",
      },
    ];
  },
};

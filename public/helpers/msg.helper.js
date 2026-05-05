
export function showToast(msg, type = "success") {
  const colors = {
    success: "#000000",
    error: "#ff0000",
    warning: "#f59e0b",
    info: "#3b82f6",
  };

  Toastify({
    text: (msg || "").toUpperCase(),
    duration: 3000,
    gravity: "top",
    position: "center",
    stopOnFocus: true,
    style: {
      background: colors[type] || "#000",
      borderRadius: "0px",
      padding: "15px 40px",
      fontSize: "0.7rem",
      letterSpacing: "1.5px",
      textTransform: "uppercase",
      fontWeight: "500",
      fontFamily: "'Inter', sans-serif",
      color: "#ffffff"
    },
  }).showToast();
}



export function showToast(msg, type = "success") {
  const colors = {
    success: "#22c55e",
    error: "#ef4444",
    warning: "#f59e0b",
    info: "#3b82f6",
  };

  const positions = {
    error: "center",
    warning: "center",
    success: "right",
    info: "right",
  };

  Toastify({
    text: msg,
    duration: 3000,
    gravity: "top",
    position: positions[type] || right,
    close: true,
    stopOnFocus: true,
    style: {
      background: colors[type],
      borderRadius: "8px",
      padding: "12px 20px",
      fontSize: "14px",
    },
  }).showToast();
}
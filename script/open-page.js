function open_animation(p) {
    const text = p.innerHTML;
    window.location.href = "Page/code.html?text=" + 
    encodeURIComponent(text);
}
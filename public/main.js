document.addEventListener("DOMContentLoaded", function() {
  const navToggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function() {
      navLinks.classList.toggle('active');
      navToggle.classList.toggle('open'); // Optional: animate hamburger
    });
    // Optional: Close menu when a nav-link is clicked (for mobile)
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => navLinks.classList.remove('active'));
    });
  }
});
function toggleRules() {
  const content = document.getElementById('tourney-rules-content');
  const arrow = document.getElementById('rules-arrow'); // ✅ fixed this line
  const isVisible = content.style.display === "block";
  content.style.display = isVisible ? "none" : "block";
  arrow.classList.toggle('expanded', !isVisible); // ✅ use CSS class toggle
}
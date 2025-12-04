// Load gtag.js
(function() {
  var script = document.createElement('script');
  script.async = true;
  script.src = "https://www.googletagmanager.com/gtag/js?id=G-6TR80BKKNJ";
  document.head.appendChild(script);
})();

// Initialize GA
window.dataLayer = window.dataLayer || [];
function gtag(){ dataLayer.push(arguments); }
gtag('js', new Date());
gtag('config', 'G-6TR80BKKNJ');

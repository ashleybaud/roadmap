function contactHtml(t,place,town){
  const phone=t.phone||t["contact:phone"],web=t.website||t["contact:website"],mail=t.email||t["contact:email"];
  return `${phone?`<a href="tel:${esc(String(phone).replace(/\s/g,""))}" class="mono">${esc(phone)}</a>`:""}${mail?`<a href="mailto:${esc(mail)}">${esc(mail)}</a>`:""}
    <span class="note">${web?`<a href="${esc(web)}" target="_blank" rel="noopener">Website</a> · `:""}<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place+" "+town)}" target="_blank" rel="noopener">Reviews</a></span>`;
}

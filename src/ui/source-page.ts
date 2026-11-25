import sources from '../../data/sources.json';

export function renderSourceList() {
  const list = document.createElement('ul');
  list.className = 'source-list';
  for (const { name, use, date, url, license, licenseUrl, localLicense } of sources) {
    const item = document.createElement('li');
    item.setAttribute('data-menu-block', '');
    const title = document.createElement('a');
    title.href = url;
    title.target = '_blank';
    title.rel = 'noopener noreferrer';
    title.textContent = name;
    const description = document.createElement('p');
    description.textContent = use;
    const details = document.createElement('p');
    details.textContent = `${date} · `;
    const licenseHref = localLicense ? `${import.meta.env.BASE_URL}${localLicense}` : licenseUrl;
    if (licenseHref) {
      const link = document.createElement('a');
      link.href = licenseHref;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = license;
      details.append(link);
    } else {
      details.append(license);
    }
    item.append(title, description, details);
    list.append(item);
  }
  return list;
}

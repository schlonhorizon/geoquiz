export function flagImage(code: string, alt = '') {
  const image = document.createElement('img');
  image.src = `${import.meta.env.BASE_URL}data/flags/${code}.svg`;
  image.alt = alt;
  image.width = 80;
  image.height = 60;
  return image;
}

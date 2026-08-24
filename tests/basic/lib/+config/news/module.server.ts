export const buildNewsUrl = (doc: { attributes: { slug: string } }) =>
  `${process.env.PUBLIC_RIME_URL}/actualites/${doc.attributes.slug}`;

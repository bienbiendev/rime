export const buildNewsUrl = ({ slug }: { slug: string }) =>
  `${process.env.PUBLIC_RIME_URL}/actualites/${slug}`;

type PageTitleProps = {
  title: string;
};

/** The browser tab title: "<page> | Helpa". React 19 hoists it to <head>. */
export function PageTitle({ title }: PageTitleProps) {
  return <title>{`${title} | Helpa`}</title>;
}

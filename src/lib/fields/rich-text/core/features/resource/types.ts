/** A resource node's attributes: a picked document, or all null when none is picked yet. */
export type RichTextResource =
  | {
      id: string;
      title: string;
      _type: string;
      _thumbnail?: string;
    }
  | {
      id: null;
      title: null;
      _type: null;
      _thumbnail: null;
    };

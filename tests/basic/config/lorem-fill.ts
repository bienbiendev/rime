import type { RichTextFeatureNode } from '$lib/fields/rich-text/core/types';
import { SquarePilcrow } from '@lucide/svelte';

const lorems = [
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Proin auctor, sapien nec mollis pharetra, ante massa ullamcorper nisl, at blandit magna purus at est.',
  'Nam vel ullamcorper elit, vitae vestibulum leo. Praesent id augue vehicula, placerat risus vitae, sagittis ante. Aenean nulla sapien, aliquet non sodales nec, commodo id tellus.',
  'Cras tincidunt dapibus sem, imperdiet pretium mi faucibus sed. Ut tincidunt nunc ligula, vitae gravida mauris lacinia at.'
];

// Create bold feature item
const fillWithLorem: RichTextFeatureNode = {
  label: 'Fill with Lorem',
  icon: SquarePilcrow,
  suggestion: {
    command: ({ editor }) => {
      const randomIndex = Math.floor(Math.random() * lorems.length);
      editor.chain().focus().insertContent(lorems[randomIndex]).run();
    }
  }
};

export default {
  name: 'lorem-fill',
  marks: [fillWithLorem]
};

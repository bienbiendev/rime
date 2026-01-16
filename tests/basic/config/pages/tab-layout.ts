import {
	block,
	blocks,
	group,
	relation,
	richText,
	select,
	separator,
	tab,
	text,
	tree
} from '$lib/fields/index.js';

const blockKeyFacts = block('keyFacts').fields(
	tree('facts')
		.fields(
			//
			text('title'),
			richText('description'),
			select('icon').options('one', 'two'),
			relation('image').to('medias')
		)
		.renderTitle(({ values }) => values.title)
);

const blockParagraph = block('paragraph').fields(richText('text'));
const blockImage = block('image').fields(
	relation('image').to('medias').query(`where[mimeType][like]=image`)
);
const blockSlider = block('slider').fields(relation('images').to('medias').many());
const blockSubContent = block('content').fields(text('title'), richText('text'));
const blockBlack = block('black').fields(
	text('title'),
	blocks('text', [blockParagraph, blockImage, blockSlider, blockSubContent])
);

export const tabLayout = tab('layout')
	.label('Layout')
	.fields(
		group('hero').fields(text('title').isTitle(), text('intro'), relation('image').to('medias')),
		separator(),
		blocks('sections', [blockParagraph, blockImage, blockSlider, blockKeyFacts, blockBlack])
	);

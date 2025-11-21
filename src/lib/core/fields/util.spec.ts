import { normalizeFieldPath } from '$lib/util/doc.js';
import { expect, test } from 'vitest';
import { getFieldConfigByPath } from './util.js';

const fields = [
	{
		type: 'tabs',
		live: true,
		tabs: [
			{
				name: 'hero',
				label: 'hero',
				fields: [
					{
						type: 'radio',
						live: true,
						name: 'heroType',
						defaultValue: 'banner',
						options: [
							{ label: 'Banner', value: 'banner' },
							{ label: 'Text', value: 'text' }
						]
					},
					{
						type: 'relation',
						live: true,
						name: 'image',
						defaultValue: [],
						hooks: {},
						relationTo: 'medias'
					},
					{
						type: 'richText',
						live: true,
						name: 'intro',
						defaultValue: null,
						marks: ['bold'],
						nodes: [],
						hooks: {}
					}
				]
			},
			{
				name: 'layout',
				label: 'layout',
				fields: [
					{
						type: 'blocks',
						live: true,
						name: 'components',
						defaultValue: [],
						blocks: [
							{
								name: 'paragraph',
								fields: [
									{
										type: 'richText',
										live: true,
										name: 'text',
										defaultValue: null,
										marks: ['bold', 'italic', 'strike', 'underline'],
										nodes: ['p', 'h2', 'h3', 'ol', 'ul', 'blockquote', 'a'],
										hooks: {},
										localized: true
									},
									{
										type: 'text',
										live: true,
										name: 'type',
										defaultValue: null,
										hidden: true,
										placeholder: 'Type'
									}
								],
								description: 'Simple paragraph'
							},
							{
								name: 'slider',
								fields: [
									{
										type: 'text',
										live: true,
										name: 'image',
										defaultValue: null,
										placeholder: 'Image'
									},
									{
										type: 'text',
										live: true,
										name: 'type',
										defaultValue: null,
										hidden: true,
										placeholder: 'Type'
									},
									{
										type: 'tree',
										name: 'legends',
										fields: [{ type: 'text', name: 'legend' }]
									}
								],
								description: 'Simple slider'
							}
						],
						table: { position: 99 }
					}
				]
			},
			{
				name: 'attributes',
				label: 'attributes',
				fields: [
					{
						type: 'text',
						live: true,
						name: 'title',
						defaultValue: null,
						isTitle: true,
						localized: true,
						required: true,
						placeholder: 'Title'
					},
					{
						type: 'group',
						name: 'group',
						fields: [
							{ type: 'relation', name: 'image', relationTo: 'medias' },
							{ type: 'toggle', name: 'ok' }
						]
					}
				]
			},
			{
				name: 'footer',
				label: 'footer',
				fields: [
					{
						type: 'tree',
						name: 'nav',
						fields: [
							{ name: 'label', type: 'text' },
							{ name: 'link', type: 'link' },
							{ name: 'group', type: 'group', fields: [{ name: 'metaTitle', type: 'text' }] }
						]
					}
				]
			}
		]
	},
	{
		type: 'text',
		live: true,
		name: 'status',
		defaultValue: 'draft',
		hidden: true,
		placeholder: 'Status'
	},
	{
		type: 'text',
		live: true,
		name: 'editedBy',
		defaultValue: null,
		hidden: true,
		placeholder: 'EditedBy'
	},
	{
		type: 'date',
		live: true,
		name: 'createdAt',
		hooks: {},
		hidden: true
	},
	{
		type: 'date',
		live: true,
		name: 'updatedAt',
		hooks: {},
		hidden: true
	}
];

test('should return bar.0.foo', () => {
	const res = normalizeFieldPath('bar.0:booz.foo');
	expect(res).toBe('bar.0.foo');
});

test('should return bar.0.foo.4.baz', () => {
	const res = normalizeFieldPath('bar.0:hello.foo.4:guys.baz');
	expect(res).toBe('bar.0.foo.4.baz');
});

test('should return bar.0.foo.4.baz', () => {
	const res = normalizeFieldPath('bar.0.foo.4.baz');
	expect(res).toBe('bar.0.foo.4.baz');
});

test('should return bar.0.Foo12.4.baz', () => {
	const res = normalizeFieldPath('bar.0:3someCase.Foo12.4.baz');
	expect(res).toBe('bar.0.Foo12.4.baz');
});

test('should return correct config', () => {
	//@ts-expect-error no need for field.access prop for testing this
	const field = getFieldConfigByPath('hero.heroType', fields);
	expect(field).toBeDefined();
	expect(field?.name).toBeDefined();
	expect(field?.name).toBe('heroType');
});

test('should return correct block field config', () => {
	//@ts-expect-error no need for field.access prop for testing this
	const field = getFieldConfigByPath('layout.components.0:paragraph.text', fields);
	expect(field).toBeDefined();
	expect(field?.name).toBeDefined();
	expect(field?.name).toBe('text');
	expect(field?.type).toBe('richText');
});

test('should return correct title field config', () => {
	//@ts-expect-error no need for field.access prop for testing this
	const field = getFieldConfigByPath('attributes.title', fields);
	expect(field).toBeDefined();
	expect(field?.name).toBeDefined();
	expect(field?.name).toBe('title');
	expect(field?.type).toBe('text');
});

test('should return correct field config inside group', () => {
	//@ts-expect-error no need for field.access prop for testing this
	const field = getFieldConfigByPath('attributes.group.ok', fields);
	expect(field).toBeDefined();
	expect(field?.name).toBeDefined();
	expect(field?.name).toBe('ok');
	expect(field?.type).toBe('toggle');
});

test('should return correct field config inside tree', () => {
	//@ts-expect-error no need for field.access prop for testing this
	const field = getFieldConfigByPath('footer.nav.0.label', fields);
	expect(field).toBeDefined();
	expect(field?.name).toBeDefined();
	expect(field?.name).toBe('label');
	expect(field?.type).toBe('text');
});

test('should return correct field config inside tree 2', () => {
	//@ts-expect-error no need for field.access prop for testing this
	const field = getFieldConfigByPath('footer.nav.0.link', fields);
	expect(field).toBeDefined();
	expect(field?.name).toBeDefined();
	expect(field?.name).toBe('link');
	expect(field?.type).toBe('link');
});

test('should return correct field config inside tree inside group', () => {
	//@ts-expect-error no need for field.access prop for testing this
	const field = getFieldConfigByPath('footer.nav.0.group.metaTitle', fields);
	expect(field).toBeDefined();
	expect(field?.name).toBeDefined();
	expect(field?.name).toBe('metaTitle');
	expect(field?.type).toBe('text');
});

test('should return correct field config inside blocks inside tree', () => {
	//@ts-expect-error no need for field.access prop for testing this
	const field = getFieldConfigByPath('layout.components.0:slider.legends.0.legend', fields);
	expect(field).toBeDefined();
	expect(field?.name).toBeDefined();
	expect(field?.name).toBe('legend');
	expect(field?.type).toBe('text');
});

test('should not return field config inside blocks without param inBlockType', () => {
	//@ts-expect-error no need for field.access prop for testing this
	const field = getFieldConfigByPath('layout.components.0.legends.0.legend', fields);
	expect(field).toBe(undefined);
});

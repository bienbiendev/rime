import { expect, test } from 'vitest';
import { isRelationPopulated } from './client';
import type { RelationValue } from '../types';

const stringArrayRel = [
	'7674e91b-598a-4a72-a5cd-9594736a34dd',
	'8674e91b-598a-4a72-a5cd-9594736a34dd'
];
const stringRel = '7674e91b-598a-4a72-a5cd-9594736a34dd';

const relation = [
	{
		id: '7674e91b-598a-4a72-a5cd-9594736a34dd',
		relationTo: 'articles',
		documentId: 'b674e91b-598a-4a72-a5cd-9594736a34dd'
	}
];

const doc = {
	id: '7674e91b-598a-4a72-a5cd-9594736a34dd',
	title: 'Sample Document',
	createdAt: '2024-06-01T00:00:00.000Z',
	updatedAt: '2024-06-01T00:00:00.000Z'
};

test('should return false for non array', () => {
	expect(isRelationPopulated(stringRel)).toBe(false);
});

test('should return false for empty array', () => {
	expect(isRelationPopulated([])).toBe(false);
});

test('should return false for relation object', () => {
	expect(isRelationPopulated(relation)).toBe(false);
});

test('should return true', () => {
	expect(isRelationPopulated([doc])).toBe(true);
});

import { RimeError } from '$lib/core/errors/index.js';
import type { TreeBlock } from '$lib/core/types/doc.js';
import { isObjectLiteral } from '$lib/util/object.js';
import type { WithRequired } from '$lib/util/types.js';
import type { OperationContext } from '../hooks/index.server.js';

type TreeBlockWithPath = WithRequired<TreeBlock, 'path'>;
type TreeBlockForUpdate = Omit<TreeBlock, 'id' | 'path'> & {
	id?: string;
	path: string;
};

export type TreeBlocksDiff = {
	toAdd: TreeBlockWithPath[];
	toDelete: TreeBlockWithPath[];
	toUpdate: TreeBlockForUpdate[];
};

type DefineTreeBlocksDiffArgs = {
	existingBlocks: TreeBlockWithPath[];
	incomingBlocks: TreeBlockForUpdate[];
	context: OperationContext;
};

// Utility to filter out blocks that haven't id
const blockHasId = (b: TreeBlockForUpdate): b is TreeBlockWithPath => !!b.id;

export function defineTreeBlocksDiff({
	existingBlocks,
	incomingBlocks,
	context
}: DefineTreeBlocksDiffArgs): TreeBlocksDiff {
	//
	const configMap = context.configMap;
	if (!configMap)
		throw new RimeError(RimeError.OPERATION_ERROR, 'missing configMap @defineBlocksDiff');

	// On fallback locale :
	// - If a block is localized, it should not keep its id so a new one is created
	// - If a block is not localized than it should keep its id so block is updated
	if (context.isFallbackLocale) {
		incomingBlocks = incomingBlocks.map((block) => {
			const isLocalized: boolean = configMap[block.path]?.localized || false;
			if (isLocalized) {
				delete block.id;
				block.locale = context.isFallbackLocale;
			}
			return block;
		});
	}

	// Consider blocks as new if they have temp ID OR no ID at all
	const toAdd = incomingBlocks.filter((block) => !block.id || block.id.startsWith('temp-'));

	const toDelete = existingBlocks.filter((existing) => {
		return !incomingBlocks.some((newBlock) => {
			// Only compare blocks that have real IDs
			if (!newBlock.id || newBlock.id.startsWith('temp-')) return false;
			return newBlock.id === existing.id;
		});
	});

	const toUpdate = incomingBlocks.filter(blockHasId).filter((newBlock) => {
		// Skip blocks with temp IDs
		if (newBlock.id.startsWith('temp-')) return false;
		// Skip block that doesn't exists in existingBlocks
		const existing = existingBlocks.find((e) => e.id === newBlock.id);
		if (!existing) return false;

		// Compare
		for (const [key, val] of Object.entries(existing)) {
			// array of string, ex: select field
			if (Array.isArray(val) && val.length && typeof val[0] === 'string') {
				for (const [index, item] of val.entries()) {
					if (!newBlock[key] || item !== newBlock[key][index]) {
						return true;
					}
				}
			} else if (isObjectLiteral(val)) {
				if (newBlock[key] && JSON.stringify(val) !== JSON.stringify(newBlock[key])) {
					return true;
				}
			} else if (val !== newBlock[key]) {
				// if the value differs from original than it should update
				return true;
			}
		}
		return false;
	});

	return { toAdd, toDelete, toUpdate };
}

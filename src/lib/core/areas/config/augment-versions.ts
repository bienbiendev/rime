import type { VersionsConfig } from '$lib/core/config/types.js';
import { VERSIONS_STATUS } from '$lib/core/constant.js';
import { text } from '$lib/fields/text/index.js';
import type { Area } from '../../../types.js';

type Input = { versions?: Area<any>['versions']; fields?: Area<any>['fields'] };
type WithVersionsConfig<T> = Omit<T, 'versions'> & { versions?: Required<VersionsConfig> };

/**
 * Normalize versions prop and add status field if config.versions.drat is true
 */
export const augmentVersions = <T extends Input>(config: T): WithVersionsConfig<T> => {
	const fields = [...(config.fields || [])];
	const { versions, ...rest } = config;

	let normalizedVersions: Required<VersionsConfig> | undefined;

	if (versions) {
		// Create a properly typed object with all required properties
		normalizedVersions = {
			draft: typeof versions === 'boolean' ? false : (versions.draft ?? false),
			autoSave: typeof versions === 'boolean' ? false : (versions.autoSave ?? false),
			maxVersions: typeof versions === 'boolean' ? 12 : (versions.maxVersions ?? 12)
		};

		if (normalizedVersions.draft) {
			fields.push(text('status').defaultValue(VERSIONS_STATUS.DRAFT).hidden());
		}
	} else {
		normalizedVersions = undefined;
	}

	return { ...rest, versions: normalizedVersions, fields };
};

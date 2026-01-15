import { filePathToBase64 } from '$lib/core/collections/upload/util/converter.js';
import test, { expect } from '@playwright/test';
import path from 'path';
import { clearLog, logToFile } from '../../src/log.js';
import { API_BASE_URL, signIn } from '../util.js';

const signInSuperAdmin = signIn('admin@bienoubien.studio', 'a&1Aa&1A');
const signInEditor = signIn('editor@bienoubien.com', 'a&1Aa&1A');

/****************************************************
/* Init
/****************************************************/

test('Second init should return 404', async ({ request }) => {
	const response = await request.post(`${API_BASE_URL}/init`, {
		data: {
			email: 'admin@bienoubien.studio',
			name: 'Admin',
			password: 'a&1Aa&1A'
		}
	});
	expect(response.status()).toBe(404);
});

/****************************************************
/* Login
/****************************************************/

let adminUserId: string;

test('Login should not be successfull', async ({ request }) => {
	const response = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
		data: {
			email: 'admin@bienoubien.studio',
			password: '12345678'
		}
	});
	expect(response.status()).toBe(401);
});

test('Login should be successfull', async ({ request }) => {
	const response = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
		data: {
			email: 'admin@bienoubien.studio',
			password: 'a&1Aa&1A'
		}
	});
	const json = await response.json();
	expect(json.user).toBeDefined();
	expect(json.user.id).toBeDefined();
	adminUserId = json.user.id;
});

/****************************************************
/* Collections
/****************************************************/

let homeId: string;
let pageId: string;

/**
 * Offset limit
 */
test('Should get correct offset / limit', async ({ request }) => {
	const headers = await signInSuperAdmin(request);
	const to3digits = (n: number) => n.toString().padStart(3, '0');

	// Create 100 pages
	for (let i = 1; i < 30; i++) {
		const response = await request.post(`${API_BASE_URL}/pages`, {
			headers,
			data: {
				attributes: {
					title: 'Page ' + to3digits(i),
					slug: 'page-' + to3digits(i)
				}
			}
		});
		expect(response.status()).toBe(200);
	}

	// Check findAll
	for (let i = 1; i < 3; i++) {
		const pagination = i;
		const offset = (pagination - 1) * 10;
		const response = await request
			.get(`${API_BASE_URL}/pages?limit=10&offset=${offset}&sort=attributes.title`)
			.then((response) => {
				return response.json();
			});
		expect(response.docs).toBeDefined();
		expect(response.docs.length).toBe(10);
		expect(response.docs.at(0).title).toBe('Page ' + to3digits(offset + 1));
		expect(response.docs.at(9).title).toBe('Page ' + to3digits(offset + 10));
	}

	// Create 100 other pages
	for (let i = 1; i < 30; i++) {
		await request
			.post(`${API_BASE_URL}/pages`, {
				headers,
				data: {
					attributes: {
						title: 'Other ' + to3digits(i),
						slug: 'other-' + to3digits(i)
					}
				}
			})
			.then((r) => r.json());
	}

	// Check with query
	for (let i = 1; i < 3; i++) {
		const pagination = i;
		const offset = (pagination - 1) * 10;
		const response = await request
			.get(
				`${API_BASE_URL}/pages?where[attributes.slug][like]=other-&limit=10&offset=${offset}&sort=createdAt`
			)
			.then((response) => {
				return response.json();
			});
		expect(response.docs).toBeDefined();
		expect(response.docs.length).toBe(10);
		expect(response.docs.at(0).title).toBe('Other ' + to3digits(offset + 1));
		expect(response.docs.at(9).title).toBe('Other ' + to3digits(offset + 10));
	}

	// Clean, delete all pages
	let allPages = await request
		.get(`${API_BASE_URL}/pages`)
		.then((r) => r.json())
		.then((r) => r.docs);

	expect(allPages.toBeDefined);
	expect(allPages.length).toBe(58);

	const ids = allPages.map((p: { id: string }) => p.id).join(',');
	await request.delete(`${API_BASE_URL}/pages?where[id][in_array]=${ids}`, {
		headers
	});

	allPages = await request
		.get(`${API_BASE_URL}/pages`)
		.then((r) => r.json())
		.then((r) => r.docs);
	expect(allPages).toBeDefined();
	expect(allPages.length).toBe(0);
});

test('Should create Home', async ({ request }) => {
	const response = await request.post(`${API_BASE_URL}/pages`, {
		headers: await signInSuperAdmin(request),
		data: {
			attributes: {
				title: 'Accueil',
				slug: 'accueil',
				isHome: true,
				author: adminUserId
			}
		}
	});

	const { doc } = await response.json();
	expect(doc.attributes.title).toBe('Accueil');
	expect(doc.attributes.isHome).toBe(true);
	expect(doc.id).toBeDefined();
	expect(doc.locale).toBeDefined();
	expect(doc.locale).toBe('fr');
	expect(doc.createdAt).toBeDefined();
	expect(doc.attributes.author).toBeDefined();
	expect(doc.attributes.author).toHaveLength(1);
	expect(doc.attributes.author.at(0).documentId).toBe(adminUserId);
	homeId = doc.id;
});

test('Should get Home EN with FR data', async ({ request }) => {
	const response = await request.get(`${API_BASE_URL}/pages/${homeId}?locale=en`);
	const { doc } = await response.json();
	expect(doc.attributes.title).toBe('Accueil');
	expect(doc.locale).toBe('en');
	expect(doc.attributes.slug).toBe('accueil');
	expect(doc.attributes.author).toBeDefined();
	expect(doc.attributes.author).toHaveLength(1);
	expect(doc.attributes.author.at(0).documentId).toBe(adminUserId);
});

test('Should set Home title/slug EN to Home/home', async ({ request }) => {
	const response = await request.patch(`${API_BASE_URL}/pages/${homeId}?locale=en`, {
		headers: await signInSuperAdmin(request),
		data: {
			attributes: {
				title: 'Home',
				slug: 'home'
			}
		}
	});

	const { doc } = await response.json();
	expect(doc.attributes.title).toBe('Home');
	expect(doc.locale).toBe('en');
	expect(doc.attributes.slug).toBe('home');
	expect(doc.attributes.author).toBeDefined();
	expect(doc.attributes.author).toHaveLength(1);
	expect(doc.attributes.author.at(0).documentId).toBe(adminUserId);
});

test('Should get Home FR with still FR data', async ({ request }) => {
	const response = await request.get(`${API_BASE_URL}/pages/${homeId}?locale=fr`);
	const { doc } = await response.json();
	expect(doc.attributes.title).toBe('Accueil');
	expect(doc.attributes.slug).toBe('accueil');
	expect(doc.attributes.author).toBeDefined();
	expect(doc.attributes.author).toHaveLength(1);
	expect(doc.attributes.author.at(0).documentId).toBe(adminUserId);
});

test('Should get Home EN with EN data', async ({ request }) => {
	const response = await request.get(`${API_BASE_URL}/pages/${homeId}?locale=en`);
	const { doc } = await response.json();
	expect(doc.attributes.title).toBe('Home');
	expect(doc.attributes.slug).toBe('home');
	expect(doc.attributes.author).toBeDefined();
	expect(doc.attributes.author).toHaveLength(1);
	expect(doc.attributes.author.at(0).documentId).toBe(adminUserId);
});

test('Should create a page', async ({ request }) => {
	const response = await request.post(`${API_BASE_URL}/pages`, {
		headers: await signInSuperAdmin(request),
		data: {
			attributes: {
				title: 'Page',
				slug: 'page'
			},
			// status: 'published',
			layout: {
				components: [
					{
						text: 'Foo',
						type: 'paragraph'
					},
					{
						type: 'image',
						legend: 'legend'
					}
				]
			}
		}
	});
	const { doc } = await response.json();
	expect(doc.attributes.title).toBe('Page');
	expect(doc.locale).toBe('fr');
	expect(doc.createdAt).toBeDefined();
	expect(doc.id).toBeDefined();
	expect(doc.layout.components.length).toBe(2);
	expect(doc.layout.components.at(0).text).toBe('Foo');
	expect(doc.layout.components.at(1).legend).toBe('legend');
	pageId = doc.id;
});

test('Should get only the layout page prop', async ({ request }) => {
	const response = await request.get(
		`${API_BASE_URL}/pages/?where[id][equals]=${pageId}&select=layout.components`,
		{
			headers: await signInSuperAdmin(request)
		}
	);
	expect(response.status()).toBe(200);
	const { docs } = await response.json();
	const doc = docs[0];
	expect(Object.keys(doc).length).toBe(2);
	expect(doc.id).toBeDefined();
	expect(doc.layout).toBeDefined();
	expect(doc.layout.components).toBeDefined();
	expect(doc.layout.components.length).toBe(2);
	expect(doc.layout.components.at(0).text).toBe('Foo');
	expect(doc.layout.components.at(1).legend).toBe('legend');
});

test('Should return the home page', async ({ request }) => {
	const response = await request.get(`${API_BASE_URL}/pages/${homeId}`).then((response) => {
		return response.json();
	});
	expect(response.doc).toBeDefined();
	expect(response.doc.attributes.title).toBe('Accueil');
	expect(response.doc.attributes.author).toBeDefined();
	expect(response.doc.attributes.author).toHaveLength(1);
	expect(response.doc.attributes.author.at(0).documentId).toBe(adminUserId);
});

test('Should return 2 pages', async ({ request }) => {
	const response = await request.get(`${API_BASE_URL}/pages`).then((response) => {
		return response.json();
	});
	expect(response.docs).toBeDefined();
	expect(response.docs.length).toBe(2);
});

/**
 *  Queries
 */
test('Should return home EN (query)', async ({ request }) => {
	const url = `${API_BASE_URL}/pages?where[attributes.title][equals]=Home&locale=en`;
	const response = await request.get(url).then((response) => {
		return response.json();
	});
	expect(response.docs).toBeDefined();
	expect(response.docs.length).toBe(1);
	expect(response.docs[0].attributes.title).toBe('Home');
});

test('Should return home EN (query) with select', async ({ request }) => {
	const url = `${API_BASE_URL}/pages?where[attributes.title][equals]=Home&locale=en&select=attributes.title`;
	const response = await request.get(url).then((response) => {
		return response.json();
	});
	expect(response.docs).toBeDefined();
	expect(response.docs.length).toBe(1);
	expect(response.docs[0].attributes.title).toBe('Home');
	expect(response.docs[0].id).toBeDefined();
	expect(Object.keys(response.docs[0]).length).toBe(2);
});

test('Should return home FR (query)', async ({ request }) => {
	const url = `${API_BASE_URL}/pages?where[attributes.author][like]=${adminUserId}`;
	const response = await request.get(url).then((response) => {
		return response.json();
	});
	expect(response.docs).toBeDefined();
	expect(response.docs.length).toBe(1);
	expect(response.docs[0].attributes.title).toBe('Accueil');
});

test('Should return home FR (query) with select', async ({ request }) => {
	const url = `${API_BASE_URL}/pages?where[attributes.author][like]=${adminUserId}&select=attributes.title`;
	const response = await request.get(url).then((response) => {
		return response.json();
	});
	expect(response.docs).toBeDefined();
	expect(response.docs.length).toBe(1);
	expect(response.docs[0].attributes.title).toBe('Accueil');
	expect(response.docs[0].id).toBeDefined();
	expect(Object.keys(response.docs[0]).length).toBe(2);
});

/****************************************************
/*  Upload Collection
/****************************************************/

let imageID: string;
test('Should create a Media', async ({ request }) => {
	const base64 = await filePathToBase64(path.resolve(process.cwd(), 'tests/basic/landscape.jpg'));
	const response = await request.post(`${API_BASE_URL}/medias`, {
		headers: await signInSuperAdmin(request),
		data: {
			file: { base64, filename: 'Land$scape -3.JPG' },
			alt: 'alt'
		}
	});
	const status = response.status();
	expect(status).toBe(200);
	const { doc } = await response.json();
	expect(doc).toBeDefined();
	expect(doc.alt).toBe('alt');
	expect(doc.filename).toBe('landscape-3.jpg');
	expect(doc.mimeType).toBe('image/jpeg');
	imageID = doc.id;
});

let pageWithAuthorId: string;
test('Should create an other page with author', async ({ request }) => {
	const response = await request.post(`${API_BASE_URL}/pages`, {
		headers: await signInSuperAdmin(request),
		data: {
			attributes: {
				title: 'Page 2',
				slug: 'page-2',
				author: adminUserId
			}
		}
	});
	const { doc } = await response.json();
	expect(doc.attributes.title).toBe('Page 2');
	expect(doc.attributes.slug).toBe('page-2');
	expect(doc.locale).toBe('fr');
	expect(doc.id).toBeDefined();
	pageWithAuthorId = doc.id;
});

test('Should return last created page with author depth', async ({ request }) => {
	const response = await request.get(`${API_BASE_URL}/pages/${pageWithAuthorId}?depth=1`, {
		headers: await signInSuperAdmin(request)
	});
	const { doc } = await response.json();
	expect(doc.attributes.title).toBe('Page 2');
	expect(doc.attributes.slug).toBe('page-2');
	expect(doc.attributes.author).toBeDefined();
	expect(doc.attributes.author.at(0).name).toBe('Admin');
});

// Relations queries: author (single) should work with equals and in_array
test('Should find pages by author equals', async ({ request }) => {
	const url = `${API_BASE_URL}/pages?where[attributes.author][equals]=${adminUserId}`;
	const response = await request.get(url).then((r) => r.json());
	expect(response.docs).toBeDefined();
	const ids = response.docs.map((d: any) => d.id);
	expect(ids).toContain(homeId);
	expect(ids).toContain(pageWithAuthorId);
});

test('Should find pages by author in_array', async ({ request }) => {
	const url = `${API_BASE_URL}/pages?where[attributes.author][in_array]=${adminUserId}`;
	const response = await request.get(url).then((r) => r.json());
	expect(response.docs).toBeDefined();
	const ids = response.docs.map((d: any) => d.id);
	expect(ids).toContain(homeId);
	expect(ids).toContain(pageWithAuthorId);
});

// Querying relation properties (e.g., author.name) should work and reuse the same query builder
test('Should find pages by author.name equals', async ({ request }) => {
	const url = `${API_BASE_URL}/pages?where[attributes.author.name][equals]=Admin`;
	const response = await request.get(url).then((r) => r.json());
	expect(response.docs).toBeDefined();
	const ids = response.docs.map((d: any) => d.id);
	expect(ids).toContain(homeId);
	expect(ids).toContain(pageWithAuthorId);
});

test('Should return Page 2 (query)', async ({ request }) => {
	const qs = `where[and][0][attributes.author][in_array]=${adminUserId}&where[and][1][attributes.slug][equals]=page-2&locale=en`;
	const url = `${API_BASE_URL}/pages?${qs}`;
	const response = await request.get(url).then((response) => {
		return response.json();
	});
	expect(response.docs).toBeDefined();
	expect(response.docs.length).toBe(1);
	expect(response.docs[0].attributes.title).toBe('Page 2');
	expect(response.docs[0].locale).toBe('en');
});

test('Should delete page', async ({ request }) => {
	const response = await request.delete(`${API_BASE_URL}/pages/${pageId}`, {
		headers: await signInSuperAdmin(request)
	});
	expect(response.status()).toBe(200);
});

test('Should return 2 page', async ({ request }) => {
	const response = await request.get(`${API_BASE_URL}/pages`).then((response) => {
		return response.json();
	});
	expect(response.docs).toBeDefined();
	expect(response.docs.length).toBe(2);
});

/** ---------------- SELECT ---------------- */

test('Should return 2 pages with only attributes.slug and id prop', async ({ request }) => {
	const response = await request
		.get(`${API_BASE_URL}/pages?select=attributes.slug`)
		.then((response) => {
			return response.json();
		});
	expect(response.docs).toBeDefined();
	expect(response.docs.length).toBe(2);
	expect(response.docs[0].id).toBeDefined();
	expect(response.docs[0].attributes.slug).toBeDefined();
	expect(response.docs[0].attributes.title).toBeUndefined();
	expect(response.docs[0].attributes.template).toBeUndefined();
	expect(response.docs[0]._parent).toBeUndefined();
	expect(response.docs[1].id).toBeDefined();
	expect(response.docs[1].attributes.slug).toBeDefined();
	expect(response.docs[1].attributes.title).toBeUndefined();
	expect(response.docs[1].attributes.template).toBeUndefined();
	expect(response.docs[1]._parent).toBeUndefined();
});

test('Should return 2 pages with only attributes slug, title and id prop', async ({ request }) => {
	const response = await request
		.get(`${API_BASE_URL}/pages?select=attributes.slug,attributes.title`)
		.then((response) => {
			return response.json();
		});
	expect(response.docs).toBeDefined();
	expect(response.docs.length).toBe(2);
	expect(response.docs[0].id).toBeDefined();
	expect(response.docs[0].attributes.slug).toBeDefined();
	expect(response.docs[0].attributes.title).toBeDefined();
	expect(response.docs[0].attributes.template).toBeUndefined();
	expect(response.docs[0]._parent).toBeUndefined();
	expect(response.docs[1].id).toBeDefined();
	expect(response.docs[1].attributes.slug).toBeDefined();
	expect(response.docs[1].attributes.title).toBeDefined();
	expect(response.docs[1].attributes.template).toBeUndefined();
	expect(response.docs[1]._parent).toBeUndefined();
});

/****************************************************
/* BLOCKS Localized
/****************************************************/

let pageWithBlockID: string;
test('Should create a page with blocks', async ({ request }) => {
	const response = await request.post(`${API_BASE_URL}/pages`, {
		headers: await signInSuperAdmin(request),
		data: {
			attributes: {
				title: 'Page with blocks',
				slug: 'page-with-blocks'
			},
			layout: {
				components: [
					{ type: 'paragraph', text: 'paragraph text' },
					{ type: 'slider', image: 'image value' },
					{ type: 'image', image: [imageID], legend: 'légende' }
				]
			}
		}
	});
	const { doc } = await response.json();
	expect(doc.attributes.title).toBe('Page with blocks');
	expect(doc.attributes.slug).toBe('page-with-blocks');
	expect(doc.layout.components).toHaveLength(3);
	expect(doc.locale).toBe('fr');
	expect(doc.id).toBeDefined();
	pageWithBlockID = doc.id;
});

test('Should get the FR content of page with blocks (fallback)', async ({ request }) => {
	const response = await request.get(`${API_BASE_URL}/pages/${pageWithBlockID}?locale=en`, {
		headers: await signInSuperAdmin(request)
	});
	const { doc } = await response.json();
	expect(doc.attributes.title).toBe('Page with blocks');
	expect(doc.attributes.slug).toBe('page-with-blocks');
	expect(doc.layout.components).toHaveLength(3);
	expect(doc.layout.components[0].type).toBe('paragraph');
	expect(doc.layout.components[0].text).toBe('paragraph text');
	expect(doc.layout.components[1].type).toBe('slider');
	expect(doc.layout.components[1].image).toBe('image value');
	expect(doc.layout.components[2].type).toBe('image');
	expect(doc.layout.components[2].legend).toBe('légende');
	expect(doc.layout.components[2].image).toBeDefined();
	expect(doc.locale).toBe('en');
});

test('Should update EN content of page with blocks', async ({ request }) => {
	const response = await request.patch(`${API_BASE_URL}/pages/${pageWithBlockID}?locale=en`, {
		headers: await signInSuperAdmin(request),
		data: {
			attributes: {
				title: 'Page with blocks but EN',
				slug: 'page-with-blocks-en'
			},
			layout: {
				components: [
					{ type: 'slider', image: 'image value en' },
					{ type: 'paragraph', text: 'paragraph text' },
					{ type: 'image', image: [imageID], legend: 'legend EN' },
					{ type: 'slider', image: 'image value but en' }
				]
			}
		}
	});
	const { doc } = await response.json();
	expect(doc.attributes.title).toBe('Page with blocks but EN');
	expect(doc.attributes.slug).toBe('page-with-blocks-en');
	expect(doc.layout.components).toHaveLength(4);
	expect(doc.layout.components[0].type).toBe('slider');
	expect(doc.layout.components[0].image).toBe('image value en');
	expect(doc.layout.components[1].type).toBe('paragraph');
	expect(doc.layout.components[1].text).toBe('paragraph text');
	expect(doc.layout.components[2].type).toBe('image');
	expect(doc.layout.components[2].legend).toBe('legend EN');
	expect(doc.layout.components[2].image).toBeDefined();
	expect(doc.layout.components[3].type).toBe('slider');
	expect(doc.layout.components[3].image).toBe('image value but en');
	expect(doc.locale).toBe('en');
	expect(doc.id).toBeDefined();
});

test('Should still get the FR content of page with blocks', async ({ request }) => {
	const response = await request.get(`${API_BASE_URL}/pages/${pageWithBlockID}`, {
		headers: await signInSuperAdmin(request)
	});
	const { doc } = await response.json();
	expect(doc.attributes.title).toBe('Page with blocks');
	expect(doc.attributes.slug).toBe('page-with-blocks');
	expect(doc.layout.components).toHaveLength(3);
	expect(doc.layout.components[0].type).toBe('paragraph');
	expect(doc.layout.components[0].text).toBe('paragraph text');
	expect(doc.layout.components[1].type).toBe('slider');
	expect(doc.layout.components[1].image).toBe('image value');
	expect(doc.layout.components[2].type).toBe('image');
	expect(doc.layout.components[2].legend).toBe('légende');
	expect(doc.layout.components[2].image).toBeDefined();
	expect(doc.locale).toBe('fr');
});

/****************************************************
/* TREE Localized
/****************************************************/

test('Should create some treeBlocks in Area Menu EN', async ({ request }) => {
	const response = await request.patch(`${API_BASE_URL}/menu?locale=en`, {
		headers: await signInSuperAdmin(request),
		data: {
			nav: [
				{
					link: {
						type: 'pages',
						value: homeId,
						target: '_self'
					}
				}
			],
			mainNav: [
				{
					link: {
						type: 'url',
						value: 'http://fooo.baz',
						target: '_self'
					}
				},
				{
					link: {
						type: 'url',
						value: 'http://fooo-2.baz',
						target: '_blank'
					}
				}
			]
		}
	});
	const { doc } = await response.json();
	expect(doc.nav).toHaveLength(1);
	expect(doc.nav[0].link).toBeDefined();
	expect(doc.mainNav).toHaveLength(2);
	expect(doc.mainNav[0].link).toBeDefined();
	expect(doc.mainNav[0].link.type).toBe('url');
	expect(doc.mainNav[0].link.value).toBe('http://fooo.baz');
	expect(doc.mainNav[0].link.target).toBe('_self');
	expect(doc.mainNav[1].link).toBeDefined();
	expect(doc.mainNav[1].link.type).toBe('url');
	expect(doc.mainNav[1].link.value).toBe('http://fooo-2.baz');
	expect(doc.mainNav[1].link.target).toBe('_blank');
	expect(doc.locale).toBe('en');
});

test('Should not get localized treeBlocks in Area Menu FR', async ({ request }) => {
	const response = await request.get(`${API_BASE_URL}/menu`, {
		headers: await signInSuperAdmin(request)
	});
	const { doc } = await response.json();
	expect(doc.nav).toHaveLength(1);
	expect(doc.nav[0].link).toBeDefined();
	expect(doc.mainNav).toHaveLength(0);
	expect(doc.locale).toBe('fr');
});

test('Should create some treeBlocks in Area Menu FR', async ({ request }) => {
	const response = await request.patch(`${API_BASE_URL}/menu`, {
		headers: await signInSuperAdmin(request),
		data: {
			mainNav: [
				{
					link: {
						type: 'url',
						value: 'http://fooo-fr.baz',
						target: '_self'
					}
				}
			]
		}
	});
	const { doc } = await response.json();
	expect(doc.nav).toHaveLength(1);
	expect(doc.nav[0].link).toBeDefined();
	expect(doc.mainNav).toHaveLength(1);
	expect(doc.mainNav[0].link).toBeDefined();
	expect(doc.mainNav[0].link.type).toBe('url');
	expect(doc.mainNav[0].link.value).toBe('http://fooo-fr.baz');
	expect(doc.mainNav[0].link.target).toBe('_self');
	expect(doc.locale).toBe('fr');
});

/****************************************************
/* AUTH Collection
/****************************************************/

test('Should create a staff editor', async ({ request }) => {
	const response = await request.post(`${API_BASE_URL}/staff`, {
		headers: await signInSuperAdmin(request),
		data: {
			email: 'editor@bienoubien.com',
			name: 'Chesster',
			roles: ['editor'],
			password: 'a&1Aa&1A'
		}
	});
	const data = await response.json();

	expect(response.status()).toBe(200);
	expect(data.doc).toBeDefined();
	expect(data.doc.id).toBeDefined();
});

test('Should not update Home', async ({ request }) => {
	const response = await request.patch(`${API_BASE_URL}/pages/${homeId}`, {
		data: {
			attributes: {
				title: 'Accueil',
				slug: 'accueil'
			}
		}
	});
	expect(response.status()).toBe(403);
});

test('Should not delete home', async ({ request }) => {
	const response = await request.delete(`${API_BASE_URL}/pages/${homeId}`);
	expect(response.status()).toBe(403);
});

test('Should not create a page', async ({ request }) => {
	const response = await request.post(`${API_BASE_URL}/pages`, {
		data: {
			attributes: {
				title: 'Page 3',
				slug: 'page-3'
			}
		}
	});
	expect(response.status()).toBe(403);
});

/****************************************************
/* Area
/****************************************************/

test('Should get settings', async ({ request }) => {
	const response = await request.get(`${API_BASE_URL}/settings`, {
		headers: await signInSuperAdmin(request)
	});
	expect(response.status()).toBe(200);
});

test('Should update settings', async ({ request }) => {
	const response = await request.patch(`${API_BASE_URL}/settings`, {
		headers: await signInSuperAdmin(request),
		data: {
			maintenance: true,
			legalMention: 'mentions légales'
		}
	});
	expect(response.status()).toBe(200);
	const { doc } = await response.json();
	expect(doc.legalMention).toBe('mentions légales');
});

test('Should update settings EN', async ({ request }) => {
	const response = await request.patch(`${API_BASE_URL}/settings?locale=en`, {
		headers: await signInSuperAdmin(request),
		data: {
			legalMention: 'legals'
		}
	});
	expect(response.status()).toBe(200);
	const { doc } = await response.json();
	expect(doc.legalMention).toBe('legals');
});

test('Should get settings FR with still FR data', async ({ request }) => {
	const response = await request.get(`${API_BASE_URL}/settings?locale=fr`, {
		headers: await signInSuperAdmin(request)
	});
	expect(response.status()).toBe(200);
	const { doc } = await response.json();
	expect(doc.legalMention).toBe('mentions légales');
});

test('Should update infos', async ({ request }) => {
	const response = await request.patch(`${API_BASE_URL}/infos`, {
		headers: await signInSuperAdmin(request),
		data: {
			instagram: '@fooo',
			legals: {
				label: 'Google',
				type: 'url',
				value: 'http://google.fr',
				target: '_self'
			}
		}
	});
	expect(response.status()).toBe(200);
	const { doc } = await response.json();
	expect(doc.legals).toBeDefined();
	expect(doc.legals.type).toBe('url');
	expect(doc.legals.value).toBe('http://google.fr');
});

test('Should update infos EN', async ({ request }) => {
	const response = await request.patch(`${API_BASE_URL}/infos?locale=en`, {
		headers: await signInSuperAdmin(request),
		data: {
			legals: {
				label: 'Google-en',
				type: 'url',
				value: 'http://google.com',
				target: '_blank'
			}
		}
	});
	expect(response.status()).toBe(200);
	const { doc } = await response.json();
	expect(doc.legals).toBeDefined();
	expect(doc.legals.label).toBe('Google-en');
	expect(doc.legals.value).toBe('http://google.com');
});

test('Should get infos FR', async ({ request }) => {
	const response = await request.get(`${API_BASE_URL}/infos`).then((r) => r.json());
	expect(response.doc.legals).toBeDefined();
	expect(response.doc.legals.value).toBe('http://google.fr');
	expect(response.doc.legals.label).toBe('Google');
});

test('Should get infos EN', async ({ request }) => {
	const response = await request.get(`${API_BASE_URL}/infos?locale=en`).then((r) => r.json());
	expect(response.doc.legals).toBeDefined();
	expect(response.doc.legals.value).toBe('http://google.com');
	expect(response.doc.legals.label).toBe('Google-en');
});

test('Should not get settings', async ({ request }) => {
	const response = await request.get(`${API_BASE_URL}/settings`);
	expect(response.status()).toBe(403);
});

test('Should get informations', async ({ request }) => {
	const response = await request.get(`${API_BASE_URL}/infos`).then((r) => r.json());
	expect(response.doc.instagram).toBe('@fooo');
});

/****************************************************
/* Relations
/****************************************************/

let page2Id: string;
let editor2Id: string;

test('Should create editor user for testing', async ({ request }) => {
	const response = await request.post(`${API_BASE_URL}/staff`, {
		headers: await signInSuperAdmin(request),
		data: {
			email: 'editor2@bienoubien.com',
			name: 'Editor2',
			roles: ['editor'],
			password: 'a&1Aa&1A'
		}
	});
	const { doc } = await response.json();
	editor2Id = doc.id;
	expect(doc.name).toBe('Editor2');
});

test('Should create page with multiple relations', async ({ request }) => {
	const payload = {
		attributes: {
			title: 'Relations Test',
			slug: 'relations-test',
			author: [adminUserId],
			contributors: [adminUserId, editor2Id],
			ambassadors: [editor2Id]
		}
	};

	const response = await request.post(`${API_BASE_URL}/pages`, {
		headers: await signInSuperAdmin(request),
		data: payload
	});

	const { doc } = await response.json();
	page2Id = doc.id;

	const verifyResponse = await request.get(`${API_BASE_URL}/pages/${page2Id}?depth=1`);
	const { doc: verifyDoc } = await verifyResponse.json();

	expect(verifyDoc.attributes.title).toBe('Relations Test');
	expect(verifyDoc.attributes.author).toBeDefined();
	expect(verifyDoc.attributes.contributors).toBeDefined();
	expect(verifyDoc.attributes.ambassadors).toBeDefined();
	expect(verifyDoc.attributes.author).toHaveLength(1);
	expect(verifyDoc.attributes.ambassadors).toHaveLength(1);
	expect(verifyDoc.attributes.contributors).toHaveLength(2);
});

// Contributors exact-match and membership tests (isolated)

test('Contributors equality/membership (isolated)', async ({ request }) => {
	const headers = await signInSuperAdmin(request);
	// Create an isolated page with two contributors
	const createRes = await request.post(`${API_BASE_URL}/pages`, {
		headers,
		data: {
			attributes: {
				title: 'Contributors Test',
				slug: 'contributors-test',
				author: [editor2Id],
				contributors: [adminUserId, editor2Id]
			}
		}
	});
	const { doc } = await createRes.json();
	const pid = doc.id;

	// equals should find the page when searching one author
	const authorIsEqualRes = await request
		.get(`${API_BASE_URL}/pages?where[attributes.author][equals]=${editor2Id}`)
		.then((r) => r.json());
	expect(authorIsEqualRes.docs).toBeDefined();
	expect(authorIsEqualRes.docs).toHaveLength(1);
	expect(authorIsEqualRes.docs[0].attributes.author).toHaveLength(1);
	expect(authorIsEqualRes.docs[0].attributes.author[0].documentId).toBe(editor2Id);

	// in_array with a single id should NOT match the page (subset semantics require a superset)
	const inArrayRes = await request
		.get(`${API_BASE_URL}/pages?where[attributes.contributors][in_array]=${adminUserId}`)
		.then((r) => r.json());
	expect(inArrayRes.docs).toBeDefined();
	const idsIn = inArrayRes.docs.map((d: any) => d.id);
	expect(idsIn).not.toContain(pid);

	// in_array with both ids should match the page (provided set is a superset)
	const inArrayCsv = await request
		.get(
			`${API_BASE_URL}/pages?where[attributes.contributors][in_array]=${adminUserId},${editor2Id}`
		)
		.then((r) => r.json());
	expect(inArrayCsv.docs).toBeDefined();
	const idsInCsv = inArrayCsv.docs.map((d: any) => d.id);
	expect(idsInCsv).toContain(pid);

	// in_array with a superset (extra id) should still match
	const inArraySuperset = await request
		.get(
			`${API_BASE_URL}/pages?where[attributes.contributors][in_array]=${adminUserId},${editor2Id},00000000-0000-0000-0000-000000000000`
		)
		.then((r) => r.json());
	expect(inArraySuperset.docs).toBeDefined();
	const idsInSup = inArraySuperset.docs.map((d: any) => d.id);
	expect(idsInSup).toContain(pid);

	// not_in_array with a single id should match (provided set is not a superset)
	const notInSingle = await request
		.get(`${API_BASE_URL}/pages?where[attributes.contributors][not_in_array]=${adminUserId}`)
		.then((r) => r.json());
	expect(notInSingle.docs).toBeDefined();
	const idsNotIn = notInSingle.docs.map((d: any) => d.id);
	expect(idsNotIn).toContain(pid);

	// not_in_array with both ids should NOT match (provided set is superset)
	const notInCsv = await request
		.get(
			`${API_BASE_URL}/pages?where[attributes.contributors][not_in_array]=${adminUserId},${editor2Id}`
		)
		.then((r) => r.json());
	expect(notInCsv.docs).toBeDefined();
	const idsNotInCsv = notInCsv.docs.map((d: any) => d.id);
	expect(idsNotInCsv).not.toContain(pid);

	// not_equals with single id should match (sets differ)
	const notEqSingle = await request
		.get(`${API_BASE_URL}/pages?where[attributes.contributors][not_equals]=${adminUserId}`)
		.then((r) => r.json());
	expect(notEqSingle.docs).toBeDefined();
	const idsNotEqSingle = notEqSingle.docs.map((d: any) => d.id);
	expect(idsNotEqSingle).toContain(pid);

	// not_equals with exact set should NOT match
	const notEqCsv = await request
		.get(
			`${API_BASE_URL}/pages?where[attributes.contributors][not_equals]=${adminUserId},${editor2Id}`
		)
		.then((r) => r.json());
	expect(notEqCsv.docs).toBeDefined();
	const idsNotEqCsv = notEqCsv.docs.map((d: any) => d.id);
	expect(idsNotEqCsv).not.toContain(pid);

	// cleanup
	await request.delete(`${API_BASE_URL}/pages/${pid}`, { headers });
});

// Ambassadors (localized) tests
test('Should match ambassadors equals for locale FR', async ({ request }) => {
	const url = `${API_BASE_URL}/pages?where[attributes.ambassadors][equals]=${editor2Id}&locale=fr`;
	const response = await request.get(url).then((r) => r.json());
	expect(response.docs).toBeDefined();
	const ids = response.docs.map((d: any) => d.id);
	expect(ids).toContain(page2Id);
});

test('Should NOT match ambassadors equals for locale EN', async ({ request }) => {
	const headers = await signInSuperAdmin(request);
	// Update EN version with different ambassadors
	await request.patch(`${API_BASE_URL}/pages/${page2Id}?locale=en`, {
		headers,
		data: {
			attributes: {
				ambassadors: [adminUserId, editor2Id]
			}
		}
	});
	const url = `${API_BASE_URL}/pages?where[attributes.ambassadors][equals]=${editor2Id}&locale=en`;
	const response = await request.get(url).then((r) => r.json());
	expect(response.docs).toBeDefined();
	const ids = response.docs.map((d: any) => d.id);
	expect(ids).not.toContain(page2Id);
});

test('Should empty author relation', async ({ request }) => {
	await request.patch(`${API_BASE_URL}/pages/${page2Id}`, {
		headers: await signInSuperAdmin(request),
		data: {
			attributes: { author: [] }
		}
	});

	const verifyResponse = await request.get(`${API_BASE_URL}/pages/${page2Id}?depth=1`);
	const { doc: verifyDoc } = await verifyResponse.json();

	expect(verifyDoc.attributes.author).toHaveLength(0);
	expect(verifyDoc.attributes.contributors).toHaveLength(2);
	expect(verifyDoc.attributes.ambassadors).toHaveLength(1);
});

test('Should reduce contributors array', async ({ request }) => {
	await request.patch(`${API_BASE_URL}/pages/${page2Id}`, {
		headers: await signInSuperAdmin(request),
		data: {
			attributes: { contributors: [adminUserId] }
		}
	});

	const verifyResponse = await request.get(`${API_BASE_URL}/pages/${page2Id}?depth=1`);
	const { doc: verifyDoc } = await verifyResponse.json();

	expect(verifyDoc.attributes.contributors).toHaveLength(1);
	expect(verifyDoc.attributes.contributors[0].id).toBe(adminUserId);
});

test('Should handle localized relations', async ({ request }) => {
	// First set FR locale
	await request.patch(`${API_BASE_URL}/pages/${page2Id}?locale=fr`, {
		headers: await signInSuperAdmin(request),
		data: {
			attributes: { ambassadors: [adminUserId] },
			locale: 'fr'
		}
	});

	// Then set EN locale
	await request.patch(`${API_BASE_URL}/pages/${page2Id}?locale=en`, {
		headers: await signInSuperAdmin(request),
		data: {
			attributes: { ambassadors: [editor2Id] },
			locale: 'en'
		}
	});

	const responseEN = await request.get(`${API_BASE_URL}/pages/${page2Id}?locale=en&depth=1`);
	const { doc: docEN } = await responseEN.json();
	const responseFR = await request.get(`${API_BASE_URL}/pages/${page2Id}?locale=fr&depth=1`);
	const { doc: docFR } = await responseFR.json();

	expect(docEN.attributes.ambassadors).toHaveLength(1);
	expect(docEN.attributes.ambassadors[0].id).toBe(editor2Id);
	expect(docFR.attributes.ambassadors).toHaveLength(1);
	expect(docFR.attributes.ambassadors[0].id).toBe(adminUserId);
});

test('Should handle multiple locales with different relations', async ({ request }) => {
	await request.patch(`${API_BASE_URL}/pages/${page2Id}?locale=fr`, {
		headers: await signInSuperAdmin(request),
		data: {
			attributes: {
				ambassadors: adminUserId
			},
			locale: 'fr'
		}
	});

	await request.patch(`${API_BASE_URL}/pages/${page2Id}?locale=en`, {
		headers: await signInSuperAdmin(request),
		data: {
			attributes: {
				ambassadors: [editor2Id]
			},
			locale: 'en'
		}
	});

	const frResponse = await request.get(`${API_BASE_URL}/pages/${page2Id}?locale=fr&depth=1`);
	const enResponse = await request.get(`${API_BASE_URL}/pages/${page2Id}?locale=en&depth=1`);

	const { doc: frDoc } = await frResponse.json();
	const { doc: enDoc } = await enResponse.json();

	expect(frDoc.attributes.ambassadors[0].id).toBe(adminUserId);
	expect(enDoc.attributes.ambassadors[0].id).toBe(editor2Id);
});

test('Should handle mixed localized and non-localized updates', async ({ request }) => {
	await request.patch(`${API_BASE_URL}/pages/${page2Id}?locale=en`, {
		headers: await signInSuperAdmin(request),
		data: {
			attributes: {
				ambassadors: [editor2Id],
				contributors: [adminUserId]
			},
			locale: 'en'
		}
	});

	const enResponse = await request.get(`${API_BASE_URL}/pages/${page2Id}?locale=en&depth=1`);
	const frResponse = await request.get(`${API_BASE_URL}/pages/${page2Id}?locale=fr&depth=1`);

	const { doc: enDoc } = await enResponse.json();
	const { doc: frDoc } = await frResponse.json();

	expect(enDoc.attributes.ambassadors[0].id).toBe(editor2Id);
	expect(frDoc.attributes.ambassadors[0].id).toBe(adminUserId);
	expect(enDoc.attributes.contributors[0].id).toBe(adminUserId);
	expect(frDoc.attributes.contributors[0].id).toBe(adminUserId);
});

test('Should handle emptying relations in specific locale', async ({ request }) => {
	await request.patch(`${API_BASE_URL}/pages/${page2Id}`, {
		headers: await signInSuperAdmin(request),
		data: {
			attributes: {
				ambassadors: []
			},
			locale: 'en'
		}
	});

	const enResponse = await request.get(`${API_BASE_URL}/pages/${page2Id}?locale=en&depth=1`);
	const frResponse = await request.get(`${API_BASE_URL}/pages/${page2Id}?locale=fr&depth=1`);

	const { doc: enDoc } = await enResponse.json();
	const { doc: frDoc } = await frResponse.json();

	expect(enDoc.attributes.ambassadors).toHaveLength(0);
	expect(frDoc.attributes.ambassadors).toHaveLength(1);
	expect(frDoc.attributes.ambassadors[0].id).toBe(adminUserId);
});

test('Should handle updates with missing locale', async ({ request }) => {
	await request.patch(`${API_BASE_URL}/pages/${page2Id}`, {
		headers: await signInSuperAdmin(request),
		data: {
			attributes: {
				contributors: [editor2Id]
			}
		}
	});

	const enResponse = await request.get(`${API_BASE_URL}/pages/${page2Id}?locale=en&depth=1`);
	const frResponse = await request.get(`${API_BASE_URL}/pages/${page2Id}?locale=fr&depth=1`);

	const { doc: enDoc } = await enResponse.json();
	const { doc: frDoc } = await frResponse.json();

	expect(enDoc.attributes.contributors[0].id).toBe(editor2Id);
	expect(frDoc.attributes.contributors[0].id).toBe(editor2Id);
});

test('Should delete test page', async ({ request }) => {
	const response = await request.delete(`${API_BASE_URL}/pages/${page2Id}`, {
		headers: await signInSuperAdmin(request)
	});
	expect(response.status()).toBe(200);
});

/****************************************************
/* Editor access
/****************************************************/

test('Should logout admin user', async ({ request }) => {
	const response = await request
		.post(`${API_BASE_URL}/auth/sign-out`, {
			headers: await signInSuperAdmin(request)
		})
		.then((r) => r.json());

	expect(response.success).toBe(true);
});

test('Should login editor', async ({ request }) => {
	const response = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
		data: {
			email: 'editor@bienoubien.com',
			password: 'a&1Aa&1A'
		}
	});

	const status = response.status();
	expect(status).toBe(200);
});

test('Editor should not update admin password', async ({ request }) => {
	const response = await request.patch(`${API_BASE_URL}/staff/${adminUserId}`, {
		headers: await signInEditor(request),
		data: {
			password: 'a&1Aa&1A'
		}
	});
	expect(response.status()).toBe(403);
});

test('Editor should not create a page', async ({ request }) => {
	const response = await request.post(`${API_BASE_URL}/pages`, {
		headers: await signInEditor(request),
		data: {
			attributes: {
				title: 'Page that will not be created',
				slug: 'page-that-will-not-be-created'
			}
		}
	});
	expect(response.status()).toBe(403);
});

test('Editor should update home', async ({ request }) => {
	const response = await request.patch(`${API_BASE_URL}/pages/${homeId}`, {
		headers: await signInEditor(request),
		data: {
			attributes: {
				title: 'Home edited by editor'
			}
		}
	});
	expect(response.status()).toBe(200);
	const data = await response.json();
	expect(data.doc.attributes.title).toBe('Home edited by editor');
});

test('Should logout editor', async ({ request }) => {
	const response = await request
		.post(`${API_BASE_URL}/auth/sign-out`, {
			headers: await signInEditor(request)
		})
		.then((r) => r.json());

	expect(response.success).toBe(true);
});

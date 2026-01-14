import { filePathToBase64 } from '$lib/core/collections/upload/util/converter.js';
import test, { expect } from '@playwright/test';
import path from 'path';
import { API_BASE_URL, signIn } from '../util.js';

const signInSuperAdmin = signIn('admin@bienoubien.studio', 'a&1Aa&1A');
const signInAdmin = signIn('admin2@bienoubien.com', 'a&1Aa&1A');
const signInEditor = signIn('editor@bienoubien.com', 'a&1Aa&1A');
const signInRegular = signIn('anonym@gmail.com', 'zé2Zzé2Z');

let superAdminId: string;
let editorId: string;
let editor2Id: string;
let editor3Id: string;
let adminId: string;
let admin2Id: string;

/****************************************************/
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

/****************************************************/
/* Login
/****************************************************/

test('Login should not be successfull', async ({ request }) => {
	const response = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
		data: {
			email: 'admin@bienoubien.studio',
			password: '12345678'
		}
	});
	expect(response.status()).toBe(401);
});

test('Superadmin login should be successfull', async ({ request }) => {
	const response = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
		data: {
			email: 'admin@bienoubien.studio',
			password: 'a&1Aa&1A'
		}
	});
	const json = await response.json();
	expect(json.user).toBeDefined();
	expect(json.user.id).toBeDefined();
	superAdminId = json.user.id;
});

/****************************************************/
/* Collection create / update / delete / read
/****************************************************/

let homeId: string;
let pageId: string;

test('Should not create Page with missing required title', async ({ request }) => {
	const response = await request.post(`${API_BASE_URL}/pages`, {
		headers: await signInSuperAdmin(request),
		data: {}
	});
	expect(response.status()).toBe(400);
});

test('Should create Home', async ({ request }) => {
	const response = await request.post(`${API_BASE_URL}/pages`, {
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
	expect(doc.createdAt).toBeDefined();
	expect(doc.id).toBeDefined();
	homeId = doc.id;
});

test('Should create a page', async ({ request }) => {
	const response = await request.post(`${API_BASE_URL}/pages`, {
		headers: await signInSuperAdmin(request),
		data: {
			attributes: {
				title: 'Page',
				slug: 'page',
				template: 'basic'
			},
			_parent: homeId
		}
	});
	const { doc } = await response.json();
	expect(doc.attributes.title).toBe('Page');
	expect(doc.createdAt).toBeDefined();
	expect(doc.id).toBeDefined();
	expect(doc._parent).toBe(homeId);
	expect(doc.attributes.template).toBe('basic');
	pageId = doc.id;
});

test('Should return the home page', async ({ request }) => {
	const response = await request.get(`${API_BASE_URL}/pages/${homeId}`).then((response) => {
		return response.json();
	});

	expect(response.doc).toBeDefined();
	expect(response.doc.attributes.title).toBe('Home');
});

test('Should return 2 pages', async ({ request }) => {
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

test('Should return page (query)', async ({ request }) => {
	const url = `${API_BASE_URL}/pages?where[_parent][equals]=${homeId}`;
	const response = await request.get(url).then((response) => {
		return response.json();
	});
	expect(response.docs).toBeDefined();
	expect(response.docs.length).toBe(1);
	expect(response.docs[0].attributes.title).toBe('Page');
});

test('Should delete page', async ({ request }) => {
	const response = await request.delete(`${API_BASE_URL}/pages/${pageId}`, {
		headers: await signInSuperAdmin(request)
	});
	expect(response.status()).toBe(200);
});

test('Should return 1 page', async ({ request }) => {
	const response = await request.get(`${API_BASE_URL}/pages`).then((response) => {
		return response.json();
	});
	expect(response.docs).toBeDefined();
	expect(response.docs.length).toBe(1);
});

/****************************************************/
/* Offset / Limit
/****************************************************/

test('Should get correct offset / limit', async ({ request }) => {
	const headers = await signInSuperAdmin(request);

	// Delete home for test // recreate at the end
	await request.delete(`${API_BASE_URL}/pages/${homeId}`, { headers });

	// Create 100 pages
	for (let i = 1; i < 100; i++) {
		await request.post(`${API_BASE_URL}/pages`, {
			headers,
			data: {
				attributes: {
					title: 'Page ' + i.toString().padStart(3, '0'),
					slug: 'page-' + i.toString().padStart(3, '0')
				}
			}
		});
	}

	// Check findAll
	for (let i = 1; i < 10; i++) {
		const pagination = i;
		const offset = (pagination - 1) * 10;
		const response = await request
			.get(`${API_BASE_URL}/pages?limit=10&offset=${offset}&sort=attributes.title`)
			.then((response) => {
				return response.json();
			});
		expect(response.docs).toBeDefined();
		expect(response.docs.length).toBe(10);
		expect(response.docs.at(0).title).toBe('Page ' + (offset + 1).toString().padStart(3, '0'));
		expect(response.docs.at(9).title).toBe('Page ' + (offset + 10).toString().padStart(3, '0'));
	}

	// Create 100 other pages
	for (let i = 1; i < 100; i++) {
		const { doc } = await request
			.post(`${API_BASE_URL}/pages`, {
				headers,
				data: {
					attributes: {
						title: 'Other ' + i.toString().padStart(3, '0'),
						slug: 'other-' + i.toString().padStart(3, '0')
					}
				}
			})
			.then((r) => r.json());

		await request.patch(`${API_BASE_URL}/pages/${doc.id}`, {
			headers,
			data: {
				createdAt: new Date(new Date('2025-05-22T06:58:35.000Z').getTime() + i * 1000)
			}
		});
	}

	// Check with query
	for (let i = 1; i < 10; i++) {
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
		expect(response.docs.at(0).title).toBe('Other ' + (offset + 1).toString().padStart(3, '0'));
		expect(response.docs.at(9).title).toBe('Other ' + (offset + 10).toString().padStart(3, '0'));
	}

	// Re-create home
	const response = await request.post(`${API_BASE_URL}/pages`, {
		headers,
		data: {
			attributes: {
				title: 'Home',
				slug: 'home'
			}
		}
	});

	const { doc } = await response.json();
	homeId = doc.id;
});

/****************************************************/
/* Upload Collection
/****************************************************/

let mediaId: string;
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
	mediaId = doc.id;
	expect(doc.alt).toBe('alt');
	expect(doc.filename).toBe('landscape-3.jpg');
	expect(doc.mimeType).toBe('image/jpeg');
	expect(doc.sizes).toBeDefined();
	expect(doc.sizes.sm).toBe('/medias/landscape-3-sm-640.webp');
	expect(doc.sizes.md).toBe('/medias/landscape-3-md-1024.webp');
	expect(doc.sizes.lg).toBe('/medias/landscape-3-lg-1536.webp');
	expect(doc.sizes.xl).toBe('/medias/landscape-3-xl-2048.webp');
	expect(doc.sizes.thumbnail).toBe('/medias/landscape-3-thumbnail-400.jpg');
	expect(doc._path).toBe('root');
});

test("Should update a media path (path doesn't exists)", async ({ request }) => {
	const response = await request.patch(`${API_BASE_URL}/medias/${mediaId}`, {
		headers: await signInSuperAdmin(request),
		data: {
			_path: 'root:baz:biz'
		}
	});
	const status = response.status();
	expect(status).toBe(200);
	const { doc } = await response.json();
	expect(doc).toBeDefined();
	expect(doc._path).toBe('root:baz:biz');
});

/****************************************************/
/* AUTH Collection
/****************************************************/

test('Should not get users', async ({ request }) => {
	const response = await request.get(`${API_BASE_URL}/staff`);
	expect(response.status()).toBe(403);
});

test('SuperAdmin sould not delete himself', async ({ request }) => {
	const response = await request.delete(`${API_BASE_URL}/staff/${superAdminId}`, {
		headers: await signInSuperAdmin(request)
	});
	expect(response.status()).toBe(403);
});

test('SuperAdmin sould not change isSuperAdmin', async ({ request }) => {
	const response = await request.patch(`${API_BASE_URL}/staff/${superAdminId}`, {
		headers: await signInSuperAdmin(request),
		data: {
			isSuperAdmin: false
		}
	});
	expect(response.status()).toBe(403);
});

test('Should get super admin user', async ({ request }) => {
	const response = await request.get(`${API_BASE_URL}/staff/${superAdminId}`, {
		headers: await signInSuperAdmin(request)
	});
	expect(response.status()).toBe(200);
	const data = await response.json();
	expect(data.doc).toBeDefined();
	expect(data.doc.id).toBe(superAdminId);
	expect(data.doc.roles).toContain('admin');
	expect(data.doc.name).toBe('Admin');
	expect(data.doc.isSuperAdmin).toBeUndefined();
});

test('Should create a user editor', async ({ request }) => {
	const response = await request.post(`${API_BASE_URL}/staff`, {
		headers: await signInSuperAdmin(request),
		data: {
			email: 'editor@bienoubien.com',
			name: 'Chesster',
			roles: ['editor'],
			password: 'a&1Aa&1A'
		}
	});
	expect(response.status()).toBe(200);
	const data = await response.json();
	expect(data.doc).toBeDefined();
	expect(data.doc.id).toBeDefined();
	editorId = data.doc.id;
});

test('Should create a 2nd user editor', async ({ request }) => {
	const response = await request.post(`${API_BASE_URL}/staff`, {
		headers: await signInSuperAdmin(request),
		data: {
			email: 'editor2@bienoubien.com',
			name: 'Chesster',
			roles: ['editor'],
			password: 'a&1Aa&1A'
		}
	});
	expect(response.status()).toBe(200);
	const data = await response.json();
	expect(data.doc).toBeDefined();
	expect(data.doc.id).toBeDefined();
	editor2Id = data.doc.id;
});

test('Should create another admin', async ({ request }) => {
	const response = await request.post(`${API_BASE_URL}/staff`, {
		headers: await signInSuperAdmin(request),
		data: {
			email: 'admin2@bienoubien.com',
			name: 'Admin2',
			roles: ['admin'],
			password: 'a&1Aa&1A'
		}
	});
	expect(response.status()).toBe(200);
	const data = await response.json();
	expect(data.doc).toBeDefined();
	expect(data.doc.id).toBeDefined();
	adminId = data.doc.id;
});

test('Should create another admin (again)', async ({ request }) => {
	const response = await request.post(`${API_BASE_URL}/staff`, {
		headers: await signInSuperAdmin(request),
		data: {
			email: 'admin3@bienoubien.com',
			name: 'Admin3',
			roles: ['admin'],
			password: 'a&1Aa&1A'
		}
	});
	expect(response.status()).toBe(200);
	const data = await response.json();
	expect(data.doc).toBeDefined();
	expect(data.doc.id).toBeDefined();
	admin2Id = data.doc.id;
});

test('Should get editor user', async ({ request }) => {
	const response = await request.get(`${API_BASE_URL}/staff/${editorId}`, {
		headers: await signInSuperAdmin(request)
	});
	expect(response.status()).toBe(200);
	const data = await response.json();
	expect(data.doc).toBeDefined();
	expect(data.doc.id).toBe(editorId);
	expect(data.doc.roles).toContain('editor');
	expect(data.doc.roles).not.toContain('admin');
	expect(data.doc.name).toBe('Chesster');
});

test('Should logout super admin', async ({ request }) => {
	const headers = await signInSuperAdmin(request);
	const response = await request
		.post(`${API_BASE_URL}/auth/sign-out`, {
			headers
		})
		.then((r) => r.json());

	expect(response.success).toBe(true);
	const responseSession = await request.get(`${API_BASE_URL}/auth/get-session`, { headers });
	expect(responseSession.status()).toBe(200);
	const json = await responseSession.json();
	expect(json).toBeNull();
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

test('Should not update area', async ({ request }) => {
	const response = await request.patch(`${API_BASE_URL}/settings`, {
		data: {
			maintenance: true
		}
	});
	expect(response.status()).toBe(403);
});

test('Admin login should be successfull', async ({ request }) => {
	const response = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
		data: {
			email: 'admin2@bienoubien.com',
			password: 'a&1Aa&1A'
		}
	});
	expect(response.status()).toBe(200);
	const json = await response.json();
	expect(json.user).toBeDefined();
	expect(json.user.id).toBeDefined();
	adminId = json.user.id;
});

test('Admin should not delete superAdmin', async ({ request }) => {
	const response = await request.delete(`${API_BASE_URL}/staff/${superAdminId}`, {
		headers: await signInAdmin(request)
	});
	expect(response.status()).toBe(403);
});

test('Admin should create a user', async ({ request }) => {
	const response = await request.post(`${API_BASE_URL}/staff`, {
		headers: await signInAdmin(request),
		data: {
			email: 'editor3@foo.com',
			name: 'editor3',
			password: 'a&1Aa&1A'
		}
	});
	expect(response.status()).toBe(200);
	const data = await response.json();
	editor3Id = data.doc.id;
});

test('Default role should be editor', async ({ request }) => {
	const response = await request.get(`${API_BASE_URL}/staff/${editor3Id}`, {
		headers: await signInAdmin(request)
	});
	expect(response.status()).toBe(200);
	const data = await response.json();
	expect(data.doc.roles.includes('admin')).toBe(false);
	expect(data.doc.roles.includes('editor')).toBe(true);
});

test('Admin should not create an admin with isSuperAdmin', async ({ request }) => {
	const response = await request.post(`${API_BASE_URL}/staff`, {
		headers: await signInAdmin(request),
		data: {
			email: 'admin2@foo.com',
			name: 'admin2',
			roles: ['admin'],
			password: 'a&1Aa&1A',
			isSuperAdmin: true
		}
	});
	expect(response.status()).toBe(403);
});

test('Admin should not update isSuperAdmin', async ({ request }) => {
	const response = await request.patch(`${API_BASE_URL}/staff/${superAdminId}`, {
		headers: await signInAdmin(request),
		data: {
			isSuperAdmin: false
		}
	});
	expect(response.status()).toBe(403);
});

test('Admin should not change superAdmin roles', async ({ request }) => {
	const response = await request.patch(`${API_BASE_URL}/staff/${superAdminId}`, {
		headers: await signInAdmin(request),
		data: {
			roles: ['editor']
		}
	});
	expect(response.status()).toBe(403);
});

/****************************************************/
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
			maintenance: true
		}
	});
	expect(response.status()).toBe(200);
});

test('Should get the updated settings', async ({ request }) => {
	const response = await request
		.get(`${API_BASE_URL}/settings`, {
			headers: await signInSuperAdmin(request)
		})
		.then((r) => r.json());
	expect(response.doc.maintenance).toBe(true);
});

test('Should not get settings', async ({ request }) => {
	const response = await request.get(`${API_BASE_URL}/settings`);
	expect(response.status()).toBe(403);
});

/** SELECT */

test('Should get settings with only id and maintenance', async ({ request }) => {
	const response = await request
		.get(`${API_BASE_URL}/settings?select=maintenance`, {
			headers: await signInSuperAdmin(request)
		})
		.then((r) => r.json());
	expect(response.doc.maintenance).toBe(true);
	expect(response.doc.id).toBeDefined();
	expect(Object.keys(response.doc).length).toBe(2);
});

/****************************************************/
/* Editor access
/****************************************************/

test('Should not logout admin user', async ({ request }) => {
	const headersAdmin = await signInSuperAdmin(request);
	const headersUser = await signInEditor(request);
	await request.post(`${API_BASE_URL}/auth/sign-out`);
	await request.post(`${API_BASE_URL}/auth/sign-out`, {
		headers: headersUser
	});
	const response = await request.get(`${API_BASE_URL}/auth/get-session`, {
		headers: headersAdmin
	});
	expect(response.status()).toBe(200);
	const data = await response.json();
	expect(data.user).toBeDefined();
	expect(data.user.email).toBe('admin@bienoubien.studio');
	expect(data.session).toBeDefined();
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

test('Editor should not change its roles', async ({ request }) => {
	await request.patch(`${API_BASE_URL}/staff/${editorId}`, {
		headers: await signInEditor(request),
		data: {
			roles: ['admin']
		}
	});

	const verification = await request.get(`${API_BASE_URL}/staff/${editorId}`, {
		headers: await signInSuperAdmin(request)
	});

	const data = await verification.json();
	expect(data.doc.roles.includes('admin')).toBe(false);
	expect(data.doc.roles.includes('editor')).toBe(true);
});

test('Editor should not create a user', async ({ request }) => {
	const response = await request.post(`${API_BASE_URL}/staff`, {
		headers: await signInEditor(request),
		data: {
			email: 'admin-by-editor@bienoubien.com',
			name: 'Admin',
			roles: ['admin'],
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
	expect(data.doc.title).toBe('Home edited by editor');
});

test('Editor should not delete superadmin', async ({ request }) => {
	const response = await request.delete(`${API_BASE_URL}/staff/${superAdminId}`, {
		headers: await signInEditor(request)
	});
	expect(response.status()).toBe(403);
});

test('Editor should not delete admin', async ({ request }) => {
	const response = await request.delete(`${API_BASE_URL}/staff/${adminId}`, {
		headers: await signInEditor(request)
	});
	expect(response.status()).toBe(403);
});

test('Editor should not delete other editors', async ({ request }) => {
	const response = await request.delete(`${API_BASE_URL}/staff/${editor2Id}`, {
		headers: await signInEditor(request)
	});
	expect(response.status()).toBe(403);
});

test('Editor should not update admin', async ({ request }) => {
	const response = await request.patch(`${API_BASE_URL}/staff/${adminId}`, {
		headers: await signInEditor(request),
		data: {
			roles: ['editor']
		}
	});
	expect(response.status()).toBe(403);
});

test('Editor should not update superadmin', async ({ request }) => {
	const response = await request.patch(`${API_BASE_URL}/staff/${superAdminId}`, {
		headers: await signInEditor(request),
		data: {
			roles: ['editor']
		}
	});
	expect(response.status()).toBe(403);
});

test('Editor should not update other editors', async ({ request }) => {
	const response = await request.patch(`${API_BASE_URL}/staff/${editor2Id}`, {
		headers: await signInEditor(request),
		data: {
			roles: ['editor']
		}
	});
	expect(response.status()).toBe(403);
});

test('Should logout editor', async ({ request }) => {
	const headers = await signInEditor(request);
	const response = await request
		.post(`${API_BASE_URL}/auth/sign-out`, {
			headers
		})
		.then((r) => r.json());

	expect(response.success).toBe(true);
	const responseSession = await request.get(`${API_BASE_URL}/auth/get-session`, { headers });
	expect(responseSession.status()).toBe(200);
	const json = await responseSession.json();
	expect(json).toBeNull();
});

/****************************************************/
/* Users access
/****************************************************/

test('Should not create a user', async ({ request }) => {
	const response = await request.post(`${API_BASE_URL}/users`, {
		data: {
			name: 'Regular',
			email: 'anonym@gmail.com',
			password: 'zé2Zzé2Z'
		}
	});
	expect(response.status()).toBe(403);
});

test('Should create a user', async ({ request }) => {
	const response = await request.post(`${API_BASE_URL}/users`, {
		headers: await signInAdmin(request),
		data: {
			name: 'Regular',
			email: 'anonym@gmail.com',
			password: 'zé2Zzé2Z'
		}
	});
	expect(response.status()).toBe(200);
});

let regularId: string;
test('Should login user', async ({ request }) => {
	const response = await request.post(`${API_BASE_URL}/auth/sign-in/email`, {
		data: {
			email: 'anonym@gmail.com',
			password: 'zé2Zzé2Z'
		}
	});
	expect(response.status()).toBe(200);
	const data = await response.json();
	expect(data.user).toBeDefined();
	regularId = data.user.id;
});

test('Regular should not create pages', async ({ request }) => {
	const response = await request.post(`${API_BASE_URL}/pages`, {
		headers: await signInRegular(request),
		data: {
			attributes: {
				title: 'not working',
				slug: 'not-working'
			}
		}
	});
	expect(response.status()).toBe(403);
});

test('Regular should not create other users', async ({ request }) => {
	const response = await request.post(`${API_BASE_URL}/users`, {
		headers: await signInRegular(request),
		data: {
			name: 'Nope',
			email: 'nope@nope.fr',
			password: 'nop3Z0PEE!'
		}
	});
	expect(response.status()).toBe(403);
});

test('Regular should not update infos', async ({ request }) => {
	const response = await request.patch(`${API_BASE_URL}/infos`, {
		headers: await signInRegular(request),
		data: {
			email: 'nope@nope.fr'
		}
	});
	expect(response.status()).toBe(403);
});

test('Regular should not update settings', async ({ request }) => {
	const response = await request.patch(`${API_BASE_URL}/settings`, {
		headers: await signInRegular(request),
		data: {
			maintenance: false
		}
	});
	expect(response.status()).toBe(403);
});

test('Regular should not create news', async ({ request }) => {
	const response = await request.post(`${API_BASE_URL}/news`, {
		headers: await signInRegular(request),
		data: {
			attributes: {
				title: 'not working',
				slug: 'not-working'
			}
		}
	});
	expect(response.status()).toBe(403);
});

test('Regular should update his website', async ({ request }) => {
	const response = await request.patch(`${API_BASE_URL}/users/${regularId}`, {
		headers: await signInRegular(request),
		data: {
			website: 'www.regular.com'
		}
	});
	expect(response.status()).toBe(200);
});

test('Regular should not update his email', async ({ request }) => {
	const response = await request.patch(`${API_BASE_URL}/users/${regularId}`, {
		headers: await signInRegular(request),
		data: {
			email: 'foo@regular.com'
		}
	});
	expect(response.status()).toBe(403);
});

test('Regular should not update a page', async ({ request }) => {
	const response = await request.patch(`${API_BASE_URL}/pages/${homeId}`, {
		headers: await signInRegular(request),
		data: {
			attributes: {
				title: "Haha I've changed the title!"
			}
		}
	});
	expect(response.status()).toBe(403);
});

test('Regular should not create a staff user', async ({ request }) => {
	const response = await request.post(`${API_BASE_URL}/staff`, {
		headers: await signInRegular(request),
		data: {
			eamil: 'admin@regular.com',
			name: 'Regular',
			password: 'zé2Zzé2Z'
		}
	});
	expect(response.status()).toBe(403);
});

test('Regular should not update a staff user', async ({ request }) => {
	const response = await request.patch(`${API_BASE_URL}/staff/${editorId}`, {
		headers: await signInRegular(request),
		data: {
			roles: ['admin']
		}
	});
	expect(response.status()).toBe(403);
});

test('Regular should not update his roles (admin)', async ({ request }) => {
	const response = await request.patch(`${API_BASE_URL}/staff/${regularId}`, {
		headers: await signInRegular(request),
		data: {
			roles: ['admin']
		}
	});
	expect(response.status()).toBe(403);
});

test('Regular should not update his roles (app)', async ({ request }) => {
	const response = await request.patch(`${API_BASE_URL}/staff/${regularId}`, {
		headers: await signInRegular(request),
		data: {
			roles: ['app']
		}
	});
	expect(response.status()).toBe(403);
});

test('Regular should not update his roles (editor)', async ({ request }) => {
	const response = await request.patch(`${API_BASE_URL}/staff/${regularId}`, {
		headers: await signInRegular(request),
		data: {
			roles: ['editor']
		}
	});
	expect(response.status()).toBe(403);
});

test('Regular should not update his roles (other-role)', async ({ request }) => {
	const response = await request.patch(`${API_BASE_URL}/staff/${regularId}`, {
		headers: await signInRegular(request),
		data: {
			roles: ['other-role']
		}
	});
	expect(response.status()).toBe(403);
});

test('Regular should not update a media', async ({ request }) => {
	const response = await request.patch(`${API_BASE_URL}/medias/${mediaId}`, {
		headers: await signInRegular(request),
		data: {
			_path: 'root',
			alt: 'hacked'
		}
	});
	const status = response.status();
	expect(status).toBe(403);
});

test('Admin should delete editor', async ({ request }) => {
	const response = await request.delete(`${API_BASE_URL}/staff/${editorId}`, {
		headers: await signInSuperAdmin(request)
	});
	expect(response.status()).toBe(200);
});

test('Admin should delete admin', async ({ request }) => {
	const response = await request.delete(`${API_BASE_URL}/staff/${admin2Id}`, {
		headers: await signInAdmin(request)
	});
	expect(response.status()).toBe(200);
});

test('SuperAdmin should delete admin', async ({ request }) => {
	const response = await request.delete(`${API_BASE_URL}/staff/${adminId}`, {
		headers: await signInSuperAdmin(request)
	});
	expect(response.status()).toBe(200);
});

/****************************************************/
/* Signup
/****************************************************/

test('Should not public sign-up as staff', async ({ request }) => {
	const response = await request.post(`${API_BASE_URL}/auth/sign-up/email`, {
		data: {
			email: 'public@public.com',
			password: 'e"3Ee"3E',
			type: 'staff'
		}
	});
	expect(response.status()).toBe(401);
});

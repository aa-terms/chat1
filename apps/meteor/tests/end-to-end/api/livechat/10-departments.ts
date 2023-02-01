/* eslint-env mocha */
import { expect } from 'chai';
import type { ILivechatDepartment } from '@rocket.chat/core-typings';
import type { Response } from 'supertest';

import { getCredentials, api, request, credentials } from '../../../data/api-data';
import { updatePermission, updateSetting } from '../../../data/permissions.helper';
import { makeAgentAvailable, createAgent, createDepartment, deleteDepartment } from '../../../data/livechat/rooms';
import { IS_EE } from '../../../e2e/config/constants';

(IS_EE ? describe : describe.skip)('LIVECHAT - Departments', function () {
	before((done) => getCredentials(done));

	before((done) => {
		updateSetting('Livechat_enabled', true).then(() =>
			updatePermission('view-livechat-manager', ['admin'])
				.then(() => createAgent())
				.then(() => makeAgentAvailable())
				.then(() => updateSetting('Omnichannel_enable_department_removal', true))
				.then(() => done()),
		);
	});

	describe('GET livechat/department', () => {
		it('should return unauthorized error when the user does not have the necessary permission', (done) => {
			updatePermission('view-livechat-departments', [])
				.then(() => updatePermission('view-l-room', []))
				.then(() => {
					request.get(api('livechat/department')).set(credentials).expect('Content-Type', 'application/json').expect(403).end(done);
				});
		});

		it('should return a list of departments', (done) => {
			updatePermission('view-livechat-departments', ['admin']).then(() => {
				request
					.get(api('livechat/department'))
					.set(credentials)
					.expect('Content-Type', 'application/json')
					.expect(200)
					.expect((res: Response) => {
						expect(res.body).to.have.property('success', true);
						expect(res.body).to.have.property('departments');
						expect(res.body.departments).to.be.an('array');
						expect(res.body.departments).to.have.length.of.at.least(0);
					})
					.end(done);
			});
		});
	});

	describe('POST livechat/departments', () => {
		it('should return unauthorized error when the user does not have the necessary permission', async () => {
			await updatePermission('manage-livechat-departments', []);
			await request
				.post(api('livechat/department'))
				.set(credentials)
				.send({
					department: { name: 'TestUnauthorized', enabled: true, showOnOfflineForm: true, showOnRegistration: true, email: 'bla@bla' },
				})
				.expect('Content-Type', 'application/json')
				.expect(403);
		});

		it('should return an error when no keys are provided', async () => {
			await updatePermission('manage-livechat-departments', ['admin']);
			await request
				.post(api('livechat/department'))
				.set(credentials)
				.send({ department: {} })
				.expect('Content-Type', 'application/json')
				.expect(400);
		});

		it('should create a new department', async () => {
			await updatePermission('manage-livechat-departments', ['admin']);
			const { body } = await request
				.post(api('livechat/department'))
				.set(credentials)
				.send({ department: { name: 'Test', enabled: true, showOnOfflineForm: true, showOnRegistration: true, email: 'bla@bla' } })
				.expect('Content-Type', 'application/json')
				.expect(200);
			expect(body).to.have.property('success', true);
			expect(body).to.have.property('department');
			expect(body.department).to.have.property('_id');
			expect(body.department).to.have.property('name', 'Test');
			expect(body.department).to.have.property('enabled', true);
			expect(body.department).to.have.property('showOnOfflineForm', true);
			expect(body.department).to.have.property('showOnRegistration', true);
			await deleteDepartment(body.department._id);
		});
	});

	describe('GET livechat/department/:_id', () => {
		it('should return unauthorized error when the user does not have the necessary permission', (done) => {
			updatePermission('view-livechat-departments', []).then(() => {
				request
					.get(api('livechat/department/testetetetstetete'))
					.set(credentials)
					.expect('Content-Type', 'application/json')
					.expect(403)
					.end(done);
			});
		}).timeout(5000);

		it('should return an error when the department does not exist', (done) => {
			updatePermission('view-livechat-departments', ['admin']).then(() => {
				request
					.get(api('livechat/department/testesteteste'))
					.set(credentials)
					.expect('Content-Type', 'application/json')
					.expect(200)
					.expect((res: Response) => {
						expect(res.body).to.have.property('success', true);
						expect(res.body).to.have.property('department');
						expect(res.body.department).to.be.null;
					})
					.end(done);
			});
		}).timeout(5000);

		it('should return the department', async () => {
			await updatePermission('view-livechat-departments', ['admin']);
			const department = await createDepartment();
			const { body } = await request
				.get(api(`livechat/department/${department._id}`))
				.set(credentials)
				.expect('Content-Type', 'application/json')
				.expect(200);
			expect(body).to.have.property('success', true);
			expect(body).to.have.property('department');
			expect(body.department).to.have.property('_id');
			expect(body.department).to.have.property('name', department.name);
			expect(body.department).to.have.property('enabled', department.enabled);
			expect(body.department).to.have.property('showOnOfflineForm', department.showOnOfflineForm);
			expect(body.department).to.have.property('showOnRegistration', department.showOnRegistration);
			expect(body.department).to.have.property('email', department.email);
			await deleteDepartment(body.department._id);
		});
	});

	describe('GET livechat/department.autocomplete', () => {
		it('should return an error when the user does not have the necessary permission', (done) => {
			updatePermission('view-livechat-departments', [])
				.then(() => updatePermission('view-l-room', []))
				.then(() => {
					request
						.get(api('livechat/department.autocomplete'))
						.set(credentials)
						.expect('Content-Type', 'application/json')
						.expect(403)
						.end(done);
				});
		});
		it('should return an error when the query is not provided', (done) => {
			updatePermission('view-livechat-departments', ['admin'])
				.then(() => updatePermission('view-l-room', ['admin']))
				.then(() => {
					request
						.get(api('livechat/department.autocomplete'))
						.set(credentials)
						.expect('Content-Type', 'application/json')
						.expect(400)
						.expect((res: Response) => {
							expect(res.body).to.have.property('success', false);
							expect(res.body).to.have.property('error');
						})
						.end(done);
				});
		});

		it('should return an error when the query is empty', (done) => {
			updatePermission('view-livechat-departments', ['admin'])
				.then(() => updatePermission('view-l-room', ['admin']))
				.then(() => {
					request
						.get(api('livechat/department.autocomplete'))
						.set(credentials)
						.query({ selector: '' })
						.expect('Content-Type', 'application/json')
						.expect(400)
						.expect((res: Response) => {
							expect(res.body).to.have.property('success', false);
							expect(res.body).to.have.property('error');
						})
						.end(done);
				});
		});

		it('should return an error when the query is not a string', (done) => {
			updatePermission('view-livechat-departments', ['admin'])
				.then(() => updatePermission('view-l-room', ['admin']))
				.then(() => {
					request
						.get(api('livechat/department.autocomplete'))
						.set(credentials)
						.query({ selector: { name: 'test' } })
						.expect('Content-Type', 'application/json')
						.expect(400)
						.expect((res: Response) => {
							expect(res.body).to.have.property('success', false);
							expect(res.body).to.have.property('error');
						})
						.end(done);
				});
		});

		it('should return an error when selector is not valid JSON', (done) => {
			updatePermission('view-livechat-departments', ['admin'])
				.then(() => updatePermission('view-l-room', ['admin']))
				.then(() => {
					request
						.get(api('livechat/department.autocomplete'))
						.set(credentials)
						.query({ selector: '{name: "test"' })
						.expect('Content-Type', 'application/json')
						.expect(400)
						.expect((res: Response) => {
							expect(res.body).to.have.property('success', false);
							expect(res.body).to.have.property('error');
						})
						.end(done);
				});
		});

		it('should return a list of departments that match selector.term', async () => {
			// Convert to async/await
			await updatePermission('view-livechat-departments', ['admin']);
			await updatePermission('view-l-room', ['admin']);
			const department = await createDepartment(undefined, 'test');
			const response = await request
				.get(api('livechat/department.autocomplete'))
				.set(credentials)
				.query({ selector: '{"term":"test"}' })
				.expect('Content-Type', 'application/json')
				.expect(200);
			expect(response.body).to.have.property('success', true);
			expect(response.body).to.have.property('items');
			expect(response.body.items).to.be.an('array');
			expect(response.body.items).to.have.length.of.at.least(1);
			expect(response.body.items[0]).to.have.property('_id');
			expect(response.body.items[0]).to.have.property('name');
			await deleteDepartment(department._id);
		});
		it('should return a list of departments excluding the ids on selector.exceptions', (done) => {
			let dep1: ILivechatDepartment;

			updatePermission('view-livechat-departments', ['admin'])
				.then(() => updatePermission('view-l-room', ['admin']))
				.then(() => createDepartment())
				.then((department: ILivechatDepartment) => {
					dep1 = department;
				})
				.then(() => createDepartment())
				.then(() => {
					request
						.get(api('livechat/department.autocomplete'))
						.set(credentials)
						.query({ selector: `{"exceptions":["${dep1._id}"]}` })
						.expect('Content-Type', 'application/json')
						.expect(200)
						.expect((res: Response) => {
							expect(res.body).to.have.property('success', true);
							expect(res.body).to.have.property('items');
							expect(res.body.items).to.be.an('array');
							expect(res.body.items).to.have.length.of.at.least(1);
							expect(res.body.items[0]).to.have.property('_id');
							expect(res.body.items[0]).to.have.property('name');
							expect(res.body.items.every((department: ILivechatDepartment) => department._id !== dep1._id)).to.be.true;
						})
						.end(done);
				});
		});
	});

	describe('GET livechat/departments.listByIds', () => {
		it('should throw an error if the user doesnt have the permission to view the departments', (done) => {
			updatePermission('view-livechat-departments', [])
				.then(() => updatePermission('view-l-room', []))
				.then(() => {
					request
						.get(api('livechat/department.listByIds'))
						.set(credentials)
						.expect('Content-Type', 'application/json')
						.expect(403)
						.end(done);
				});
		});

		it('should return an error when the query is not present', (done) => {
			updatePermission('view-livechat-departments', ['admin'])
				.then(() => updatePermission('view-l-room', ['admin']))
				.then(() => {
					request
						.get(api('livechat/department.listByIds'))
						.set(credentials)
						.expect('Content-Type', 'application/json')
						.expect(400)
						.expect((res: Response) => {
							expect(res.body).to.have.property('success', false);
							expect(res.body).to.have.property('error');
						})
						.end(done);
				});
		});

		it('should return an error when the query is not an array', (done) => {
			updatePermission('view-livechat-departments', ['admin'])
				.then(() => updatePermission('view-l-room', ['admin']))
				.then(() => {
					request
						.get(api('livechat/department.listByIds'))
						.set(credentials)
						.query({ ids: 'test' })
						.expect('Content-Type', 'application/json')
						.expect(400)
						.expect((res: Response) => {
							expect(res.body).to.have.property('success', false);
							expect(res.body).to.have.property('error');
						})
						.end(done);
				});
		});
	});

	describe('GET livechat/department/:departmentId/agents', () => {
		it('should throw an error if the user doesnt have the permission to view the departments', (done) => {
			updatePermission('view-livechat-departments', [])
				.then(() => updatePermission('view-l-room', []))
				.then(() => {
					request
						.get(api('livechat/department/test/agents'))
						.set(credentials)
						.expect('Content-Type', 'application/json')
						.expect(403)
						.end(done);
				});
		});

		it('should return an empty array when the departmentId is not valid', (done) => {
			updatePermission('view-livechat-departments', ['admin'])
				.then(() => updatePermission('view-l-room', ['admin', 'livechat-agent']))
				.then(() => {
					request
						.get(api('livechat/department/test/agents'))
						.set(credentials)
						.expect('Content-Type', 'application/json')
						.expect(200)
						.expect((res: Response) => {
							expect(res.body).to.have.property('success', true);
							expect(res.body).to.have.property('agents');
							expect(res.body.agents).to.be.an('array');
							expect(res.body.agents).to.have.lengthOf(0);
							expect(res.body.total).to.be.equal(0);
						})
						.end(done);
				});
		});

		it('should return an emtpy array for a department without agents', async () => {
			await updatePermission('view-livechat-departments', ['admin']);
			await updatePermission('view-l-room', ['admin', 'livechat-agent']);
			const dep = await createDepartment();
			const res = await request
				.get(api(`livechat/department/${dep._id}/agents`))
				.set(credentials)
				.expect(200);
			expect(res.body).to.have.property('success', true);
			expect(res.body).to.have.property('agents');
			expect(res.body.agents).to.be.an('array');
			expect(res.body.agents).to.have.lengthOf(0);
			expect(res.body.total).to.be.equal(0);
			await deleteDepartment(dep._id);
		});

		it('should return the agents of the department', async () => {
			// convert to async await
			await updatePermission('view-livechat-departments', ['admin']);
			await updatePermission('view-l-room', ['admin', 'livechat-agent']);
			const agent = await createAgent();
			const dep = await createDepartment([{ agentId: agent._id }]);
			const res = await request
				.get(api(`livechat/department/${dep._id}/agents`))
				.set(credentials)
				.expect(200);
			expect(res.body).to.have.property('success', true);
			expect(res.body).to.have.property('agents');
			expect(res.body.agents).to.be.an('array');
			expect(res.body.agents).to.have.lengthOf(1);
			expect(res.body.agents[0]).to.have.property('_id');
			expect(res.body.agents[0]).to.have.property('departmentId', dep._id);
			expect(res.body.agents[0]).to.have.property('departmentEnabled', true);
			expect(res.body.count).to.be.equal(1);
			await deleteDepartment(dep._id);
		});
	});

	describe('POST livechat/department/:departmentId/agents', () => {
		it('should throw an error if the user doesnt have the permission to manage the departments', (done) => {
			updatePermission('manage-livechat-departments', [])
				.then(() => updatePermission('add-livechat-department-agents', []))
				.then(() => {
					request
						.post(api('livechat/department/test/agents'))
						.set(credentials)
						.expect('Content-Type', 'application/json')
						.expect(403)
						.end(done);
				});
		});

		it('should throw an error if the departmentId is not valid', (done) => {
			updatePermission('manage-livechat-departments', ['admin'])
				.then(() => updatePermission('add-livechat-department-agents', ['admin', 'livechat-manager']))
				.then(() => {
					request
						.post(api('livechat/department/test/agents'))
						.set(credentials)
						.send({ upsert: [], remove: [] })
						.expect('Content-Type', 'application/json')
						.expect(400)
						.expect((res: Response) => {
							expect(res.body).to.have.property('success', false);
							expect(res.body).to.have.property('error', 'Department not found [error-department-not-found]');
						})
						.end(done);
				});
		});

		it('should throw an error if body doesnt contain { upsert: [], remove: [] }', async () => {
			await updatePermission('manage-livechat-departments', ['admin']);
			await updatePermission('add-livechat-department-agents', ['admin', 'livechat-manager']);
			const dep = await createDepartment();
			const res = await request
				.post(api(`livechat/department/${dep._id}/agents`))
				.set(credentials)
				.expect(400);
			expect(res.body).to.have.property('success', false);
			expect(res.body).to.have.property('error', "Match error: Missing key 'upsert'");
			await deleteDepartment(dep._id);
		});

		it('should throw an error if upsert or remove in body doesnt contain agentId and username', async () => {
			await updatePermission('manage-livechat-departments', ['admin']);
			await updatePermission('add-livechat-department-agents', ['admin', 'livechat-manager']);
			const dep = await createDepartment();
			const res = await request
				.post(api(`livechat/department/${dep._id}/agents`))
				.set(credentials)
				.send({ upsert: [{}], remove: [] })
				.expect(400);
			expect(res.body).to.have.property('success', false);
			expect(res.body).to.have.property('error', "Match error: Missing key 'agentId' in field upsert[0]");
			await deleteDepartment(dep._id);
		});

		it('should sucessfully add an agent to a department', async () => {
			await updatePermission('manage-livechat-departments', ['admin']);
			await updatePermission('add-livechat-department-agents', ['admin', 'livechat-manager']);
			const [dep, agent] = await Promise.all([createDepartment(), createAgent()]);
			const res = await request
				.post(api(`livechat/department/${dep._id}/agents`))
				.set(credentials)
				.send({ upsert: [{ agentId: agent._id, username: agent.username }], remove: [] })
				.expect(200);
			expect(res.body).to.have.property('success', true);
			await deleteDepartment(dep._id);
		});
	});

	describe('Department archivation', () => {
		let departmentForTest: ILivechatDepartment;
		it('should fail if user is not logged in', async () => {
			await request.post(api('livechat/department/123/archive')).expect(401);
		});
		it('should fail if user doesnt have manage-livechat-departments permission', async () => {
			await updatePermission('manage-livechat-departments', []);
			await request.post(api('livechat/department/123/archive')).set(credentials).expect(403);
		});
		it('should fail if departmentId is not valid', async () => {
			await updatePermission('manage-livechat-departments', ['admin']);
			await request.post(api('livechat/department/123/archive')).set(credentials).expect(400);
		});
		it('should archive a department', async () => {
			await updatePermission('manage-livechat-departments', ['admin']);
			const department = await createDepartment();
			await request
				.post(api(`livechat/department/${department._id}/archive`))
				.set(credentials)
				.expect(200);
			departmentForTest = department;
		});
		it('should return a list of archived departments', async () => {
			const { body } = await request.get(api('livechat/departments/archived')).set(credentials).expect(200);
			expect(body).to.have.property('success', true);
			expect(body).to.have.property('departments');
			expect(body.departments).to.be.an('array');
			expect(body.departments[0]).to.have.property('_id', departmentForTest._id);
			expect(body.departments.length).to.be.equal(1);
		});
		it('should unarchive a department', async () => {
			await request
				.post(api(`livechat/department/${departmentForTest._id}/unarchive`))
				.set(credentials)
				.expect(200);
		});
	});
});

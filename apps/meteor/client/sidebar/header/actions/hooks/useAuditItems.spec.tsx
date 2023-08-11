import { renderHook } from '@testing-library/react-hooks';

import { mockAppRoot } from './mockAppRoot';
import { useAuditItems } from './useAuditItems';

it('should return an empty array if doesn`t have license', async () => {
	const { result, waitFor } = renderHook(() => useAuditItems(), {
		wrapper: mockAppRoot()
			.withMethod('license:getModules', () => [])
			.withJohnDoe()
			.withPermission('can-audit')
			.withPermission('can-audit-log')
			.build(),
	});

	await waitFor(() => result.all.length > 1);

	expect(result.current).toEqual([]);
});

it('should return an empty array if have license and not have permissions', async () => {
	const { result, waitFor } = renderHook(() => useAuditItems(), {
		wrapper: mockAppRoot()
			.withMethod('license:getModules', () => ['auditing'])
			.withJohnDoe()
			.build(),
	});

	await waitFor(() => result.all.length > 1);

	expect(result.current).toEqual([]);
});

it('should return auditItems if have license and permissions', async () => {
	const { result, waitFor } = renderHook(() => useAuditItems(), {
		wrapper: mockAppRoot()
			.withMethod('license:getModules', () => ['auditing'])
			.withJohnDoe()
			.withPermission('can-audit')
			.withPermission('can-audit-log')
			.build(),
	});

	await waitFor(() => result.current.length > 0);

	expect(result.current[0]).toEqual(
		expect.objectContaining({
			id: 'messages',
		}),
	);

	expect(result.current[1]).toEqual(
		expect.objectContaining({
			id: 'auditLog',
		}),
	);
});

it('should return auditMessages item if have license and can-audit permission', async () => {
	const { result, waitFor } = renderHook(() => useAuditItems(), {
		wrapper: mockAppRoot()
			.withMethod('license:getModules', () => ['auditing'])
			.withJohnDoe()
			.withPermission('can-audit')
			.build(),
	});

	await waitFor(() => result.current.length > 0);

	expect(result.current[0]).toEqual(
		expect.objectContaining({
			id: 'messages',
		}),
	);
});

it('should return audiLogs item if have license and can-audit-log permission', async () => {
	const { result, waitFor } = renderHook(() => useAuditItems(), {
		wrapper: mockAppRoot()
			.withMethod('license:getModules', () => ['auditing'])
			.withJohnDoe()
			.withPermission('can-audit-log')
			.build(),
	});

	await waitFor(() => result.current.length > 0);

	expect(result.current[0]).toEqual(
		expect.objectContaining({
			id: 'auditLog',
		}),
	);
});

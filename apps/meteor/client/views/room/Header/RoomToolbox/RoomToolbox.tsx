import type { Box } from '@rocket.chat/fuselage';
import { useMutableCallback } from '@rocket.chat/fuselage-hooks';
import { HeaderToolboxAction, HeaderToolboxDivider } from '@rocket.chat/ui-client';
import { useLayout, useTranslation } from '@rocket.chat/ui-contexts';
import type { ComponentProps } from 'react';
import React, { memo } from 'react';

// used to open the menu option by keyboard
import GenericMenu from '../../../../components/GenericMenu/GenericMenu';
import type { GenericMenuItemProps } from '../../../../components/GenericMenu/GenericMenuItem';
import { useRoomToolbox, useTabBarOpen } from '../../contexts/RoomToolboxContext';

type RoomToolboxProps = {
	className?: ComponentProps<typeof Box>['className'];
};

type MenuActionsProps = {
	id: string;
	items: GenericMenuItemProps[];
}[];

const RoomToolbox = ({ className }: RoomToolboxProps) => {
	const t = useTranslation();
	const openTabBar = useTabBarOpen();
	const { isMobile } = useLayout();

	const { actions, tab } = useRoomToolbox();

	const featuredActions = actions.filter((action) => action.featured);
	const filteredActions = actions.filter((action) => !action.featured);
	const visibleActions = isMobile ? [] : filteredActions.slice(0, 6);

	const hiddenActions = (isMobile ? actions : filteredActions.slice(6))
		.filter((item) => !item.disabled && !item.featured)
		.map((item) => ({
			key: item.id,
			content: t(item.title),
			onClick: (): void => {
				openTabBar(item.id);
			},
			...item,
		}))
		.reduce((acc, item) => {
			const group = item.type ? item.type : '';
			const section = acc.find((section: { id: string }) => section.id === group);
			if (section) {
				section.items.push(item);
				return acc;
			}

			const newSection = { id: group, key: item.key, title: group === 'apps' ? t('Apps') : '', items: [item] };
			acc.push(newSection);

			return acc;
		}, [] as MenuActionsProps);

	const actionDefault = useMutableCallback((actionId) => {
		openTabBar(actionId);
	});

	return (
		<>
			{featuredActions.map(({ renderAction, id, icon, title, action = actionDefault, disabled, tooltip }, index) => {
				const props = {
					id,
					icon,
					title: t(title),
					className,
					index,
					pressed: id === tab?.id,
					action,
					disabled,
					...(tooltip ? { tooltip } : {}),
				};
				if (renderAction) {
					return renderAction(props);
				}
				return <HeaderToolboxAction {...props} key={id} />;
			})}
			{featuredActions.length > 0 && <HeaderToolboxDivider />}
			{visibleActions.map(({ renderAction, id, icon, title, action = actionDefault, disabled, tooltip }, index) => {
				const props = {
					id,
					icon,
					title: t(title),
					className,
					index,
					pressed: id === tab?.id,
					action,
					disabled,
					...(tooltip ? { tooltip } : {}),
				};
				if (renderAction) {
					return renderAction(props);
				}
				return <HeaderToolboxAction {...props} key={id} />;
			})}
			{(filteredActions.length > 6 || isMobile) && (
				<GenericMenu title={t('Options')} data-qa-id='ToolBox-Menu' sections={hiddenActions} placement='bottom-end' />
			)}
		</>
	);
};

export default memo(RoomToolbox);

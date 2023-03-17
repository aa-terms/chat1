import { Settings } from '@rocket.chat/models';
import { isGETLivechatTriggersParams } from '@rocket.chat/rest-typings';

import { API } from '../../../../api/server';
import { findTriggers, findTriggerById } from '../../../server/api/lib/triggers';

API.v1.addRoute(
	'livechat/triggers',
	{ authRequired: true, permissionsRequired: ['view-livechat-manager'], validateParams: isGETLivechatTriggersParams },
	{
		async get() {
			if (!(await Settings.findOne('Livechat_widget_enabled'))?.value) {
				return API.v1.failure('Livechat widget is disabled, please enable to use the endpoint.');
			}
			const { offset, count } = this.getPaginationItems();
			const { sort } = this.parseJsonQuery();

			const triggers = await findTriggers({
				pagination: {
					offset,
					count,
					sort,
				},
			});

			return API.v1.success(triggers);
		},
	},
);

API.v1.addRoute(
	'livechat/triggers/:_id',
	{ authRequired: true, permissionsRequired: ['view-livechat-manager'] },
	{
		async get() {
			if (!(await Settings.findOne('Livechat_widget_enabled'))?.value) {
				return API.v1.failure('Livechat widget is disabled, please enable to use the endpoint.');
			}
			const trigger = await findTriggerById({
				triggerId: this.urlParams._id,
			});

			return API.v1.success({
				trigger,
			});
		},
	},
);

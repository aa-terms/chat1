import type {
	ILivechatPriority,
	IOmnichannelRoom,
	IOmnichannelServiceLevelAgreements,
	RocketChatRecordDeleted,
	ReportResult,
} from '@rocket.chat/core-typings';
import { LivechatPriorityWeight, DEFAULT_SLA_CONFIG } from '@rocket.chat/core-typings';
import type { ILivechatRoomsModel } from '@rocket.chat/model-typings';
import type { FindCursor, UpdateResult, Document, FindOptions, Db, Collection, Filter, AggregationCursor } from 'mongodb';

import { readSecondaryPreferred } from '../../../../server/database/readSecondaryPreferred';
import { LivechatRoomsRaw } from '../../../../server/models/raw/LivechatRooms';
import { queriesLogger } from '../../../app/livechat-enterprise/server/lib/logger';
import { addQueryRestrictionsToRoomsModel } from '../../../app/livechat-enterprise/server/lib/query.helper';

declare module '@rocket.chat/model-typings' {
	interface ILivechatRoomsModel {
		associateRoomsWithDepartmentToUnit: (departments: string[], unit: string) => Promise<void>;
		removeUnitAssociationFromRooms: (unit: string) => Promise<void>;
		updateDepartmentAncestorsById: (rid: string, ancestors?: string[]) => Promise<UpdateResult>;
		unsetPredictedVisitorAbandonmentByRoomId(rid: string): Promise<UpdateResult>;
		findAbandonedOpenRooms(date: Date, extraQuery?: Filter<IOmnichannelRoom>): FindCursor<IOmnichannelRoom>;
		setPredictedVisitorAbandonmentByRoomId(roomId: string, date: Date): Promise<UpdateResult>;
		unsetAllPredictedVisitorAbandonment(): Promise<void>;
		setOnHoldByRoomId(roomId: string): Promise<UpdateResult>;
		unsetOnHoldByRoomId(roomId: string): Promise<UpdateResult>;
		unsetOnHoldAndPredictedVisitorAbandonmentByRoomId(roomId: string): Promise<UpdateResult>;
		setSlaForRoomById(
			roomId: string,
			sla: Pick<IOmnichannelServiceLevelAgreements, '_id' | 'dueTimeInMinutes'>,
		): Promise<UpdateResult | Document>;
		removeSlaFromRoomById(roomId: string): Promise<UpdateResult | Document>;
		bulkRemoveSlaFromRoomsById(slaId: string): Promise<UpdateResult | Document>;
		findOpenBySlaId(
			slaId: string,
			options: FindOptions<IOmnichannelRoom>,
			extraQuery?: Filter<IOmnichannelRoom>,
		): FindCursor<IOmnichannelRoom>;
		setPriorityByRoomId(roomId: string, priority: Pick<ILivechatPriority, '_id' | 'sortItem'>): Promise<UpdateResult>;
		unsetPriorityByRoomId(roomId: string): Promise<UpdateResult>;
		getConversationsBySource(start: Date, end: Date): AggregationCursor<ReportResult>;
		getConversationsByStatus(start: Date, end: Date): AggregationCursor<ReportResult>;
		getConversationsByDepartment(start: Date, end: Date): AggregationCursor<ReportResult>;
		getConversationsByTags(start: Date, end: Date): AggregationCursor<ReportResult>;
		getConversationsByAgents(start: Date, end: Date): AggregationCursor<ReportResult>;
	}
}

export class LivechatRoomsRawEE extends LivechatRoomsRaw implements ILivechatRoomsModel {
	constructor(db: Db, trash?: Collection<RocketChatRecordDeleted<IOmnichannelRoom>>) {
		super(db, trash);
	}

	async unsetAllPredictedVisitorAbandonment(): Promise<void> {
		return this.updateMany(
			{
				'open': true,
				't': 'l',
				'omnichannel.predictedVisitorAbandonmentAt': { $exists: true },
			},
			{
				$unset: { 'omnichannel.predictedVisitorAbandonmentAt': 1 },
			},
		).then();
	}

	setOnHoldByRoomId(roomId: string): Promise<UpdateResult> {
		return this.updateOne({ _id: roomId }, { $set: { onHold: true } });
	}

	unsetOnHoldByRoomId(roomId: string): Promise<UpdateResult> {
		return this.updateOne({ _id: roomId }, { $unset: { onHold: 1 } });
	}

	unsetOnHoldAndPredictedVisitorAbandonmentByRoomId(roomId: string): Promise<UpdateResult> {
		return this.updateOne(
			{
				_id: roomId,
			},
			{
				$unset: {
					'omnichannel.predictedVisitorAbandonmentAt': 1,
					'onHold': 1,
				},
			},
		);
	}

	setSlaForRoomById(
		roomId: string,
		sla: Pick<IOmnichannelServiceLevelAgreements, '_id' | 'dueTimeInMinutes'>,
	): Promise<UpdateResult | Document> {
		const { _id: slaId, dueTimeInMinutes } = sla;

		return this.updateOne(
			{
				_id: roomId,
			},
			{
				$set: {
					slaId,
					estimatedWaitingTimeQueue: dueTimeInMinutes,
				},
			},
		);
	}

	removeSlaFromRoomById(roomId: string): Promise<UpdateResult | Document> {
		return this.updateOne(
			{
				_id: roomId,
			},
			{
				$unset: {
					slaId: 1,
				},
				$set: {
					estimatedWaitingTimeQueue: DEFAULT_SLA_CONFIG.ESTIMATED_WAITING_TIME_QUEUE,
				},
			},
		);
	}

	bulkRemoveSlaFromRoomsById(slaId: string): Promise<UpdateResult | Document> {
		return this.updateMany(
			{
				open: true,
				t: 'l',
				slaId,
			},
			{
				$unset: { slaId: 1 },
				$set: {
					estimatedWaitingTimeQueue: DEFAULT_SLA_CONFIG.ESTIMATED_WAITING_TIME_QUEUE,
				},
			},
		);
	}

	findOpenBySlaId(
		slaId: string,
		options: FindOptions<IOmnichannelRoom>,
		extraQuery?: Filter<IOmnichannelRoom>,
	): FindCursor<IOmnichannelRoom> {
		const query = {
			t: 'l' as const,
			open: true,
			slaId,
			...extraQuery,
		};

		return this.find(query, options);
	}

	async setPriorityByRoomId(roomId: string, priority: Pick<ILivechatPriority, '_id' | 'sortItem'>): Promise<UpdateResult> {
		const { _id: priorityId, sortItem: priorityWeight } = priority;

		return this.updateOne({ _id: roomId }, { $set: { priorityId, priorityWeight } });
	}

	async unsetPriorityByRoomId(roomId: string): Promise<UpdateResult> {
		return this.updateOne(
			{ _id: roomId },
			{
				$unset: {
					priorityId: 1,
				},
				$set: {
					priorityWeight: LivechatPriorityWeight.NOT_SPECIFIED,
				},
			},
		);
	}

	setPredictedVisitorAbandonmentByRoomId(rid: string, willBeAbandonedAt: Date): Promise<UpdateResult> {
		const query = {
			_id: rid,
		};
		const update = {
			$set: {
				'omnichannel.predictedVisitorAbandonmentAt': willBeAbandonedAt,
			},
		};

		return this.updateOne(query, update);
	}

	findAbandonedOpenRooms(date: Date, extraQuery?: Filter<IOmnichannelRoom>): FindCursor<IOmnichannelRoom> {
		return this.find({
			'omnichannel.predictedVisitorAbandonmentAt': { $lte: date },
			'waitingResponse': { $exists: false },
			'closedAt': { $exists: false },
			'open': true,
			...extraQuery,
		});
	}

	async unsetPredictedVisitorAbandonmentByRoomId(roomId: string): Promise<UpdateResult> {
		return this.updateOne(
			{
				_id: roomId,
			},
			{
				$unset: { 'omnichannel.predictedVisitorAbandonmentAt': 1 },
			},
		);
	}

	async associateRoomsWithDepartmentToUnit(departments: string[], unitId: string): Promise<void> {
		const query = {
			$and: [
				{
					departmentId: { $in: departments },
				},
				{
					$or: [
						{
							departmentAncestors: { $exists: false },
						},
						{
							$and: [
								{
									departmentAncestors: { $exists: true },
								},
								{
									departmentAncestors: { $ne: unitId },
								},
							],
						},
					],
				},
			],
		};
		const update = { $set: { departmentAncestors: [unitId] } };
		queriesLogger.debug({ msg: `LivechatRoomsRawEE.associateRoomsWithDepartmentToUnit - association step`, query, update });
		const associationResult = await this.updateMany(query, update);
		queriesLogger.debug({ msg: `LivechatRoomsRawEE.associateRoomsWithDepartmentToUnit - association step`, result: associationResult });

		const queryToDisassociateOldRoomsConnectedToUnit = {
			departmentAncestors: unitId,
			departmentId: { $nin: departments },
		};
		const updateToDisassociateRooms = { $unset: { departmentAncestors: 1 } };
		queriesLogger.debug({
			msg: `LivechatRoomsRawEE.associateRoomsWithDepartmentToUnit - disassociation step`,
			query: queryToDisassociateOldRoomsConnectedToUnit,
			update: updateToDisassociateRooms,
		});
		const disassociationResult = await this.updateMany(queryToDisassociateOldRoomsConnectedToUnit, updateToDisassociateRooms);
		queriesLogger.debug({
			msg: `LivechatRoomsRawEE.associateRoomsWithDepartmentToUnit - disassociation step`,
			result: disassociationResult,
		});
	}

	async removeUnitAssociationFromRooms(unitId: string): Promise<void> {
		const query = {
			departmentAncestors: unitId,
		};
		const update = { $unset: { departmentAncestors: 1 } };
		queriesLogger.debug({ msg: `LivechatRoomsRawEE.removeUnitAssociationFromRooms`, query, update });
		const result = await this.updateMany(query, update);
		queriesLogger.debug({ msg: `LivechatRoomsRawEE.removeUnitAssociationFromRooms`, result });
	}

	async updateDepartmentAncestorsById(rid: string, departmentAncestors?: string[]) {
		const query = {
			_id: rid,
		};
		const update = departmentAncestors ? { $set: { departmentAncestors } } : { $unset: { departmentAncestors: 1 } };
		return this.updateOne(query, update);
	}

	/** @deprecated Use updateOne or updateMany instead */
	async update(...args: Parameters<LivechatRoomsRaw['update']>) {
		const [query, ...restArgs] = args;
		const restrictedQuery = await addQueryRestrictionsToRoomsModel(query);
		queriesLogger.debug({ msg: 'LivechatRoomsRawEE.update', query: restrictedQuery });
		return super.update(restrictedQuery, ...restArgs);
	}

	async updateOne(...args: [...Parameters<LivechatRoomsRaw['updateOne']>, { bypassUnits?: boolean }?]) {
		const [query, update, opts, extraOpts] = args;
		if (extraOpts?.bypassUnits) {
			// When calling updateOne from a service, we cannot call the meteor code inside the query restrictions
			// So the solution now is to pass a bypassUnits flag to the updateOne method which prevents checking
			// units restrictions on the query, but just for the query the service is actually using
			// We need to find a way of remove the meteor dependency when fetching units, and then, we can remove this flag
			return super.updateOne(query, update, opts);
		}
		const restrictedQuery = await addQueryRestrictionsToRoomsModel(query);
		queriesLogger.debug({ msg: 'LivechatRoomsRawEE.updateOne', query: restrictedQuery });
		return super.updateOne(restrictedQuery, update, opts);
	}

	async updateMany(...args: Parameters<LivechatRoomsRaw['updateMany']>) {
		const [query, ...restArgs] = args;
		const restrictedQuery = await addQueryRestrictionsToRoomsModel(query);
		queriesLogger.debug({ msg: 'LivechatRoomsRawEE.updateMany', query: restrictedQuery });
		return super.updateMany(restrictedQuery, ...restArgs);
	}

	getConversationsBySource(start: Date, end: Date): AggregationCursor<{ data: { label: string; value: number }[] }> {
		return this.col.aggregate(
			[
				{
					$match: {
						source: {
							$exists: true,
						},
						t: 'l',
						ts: {
							$gte: start,
							$lt: end,
						},
					},
				},
				{
					$group: {
						_id: '$source',
						value: { $sum: 1 },
					},
				},
				{
					$group: {
						_id: null,
						data: {
							$push: {
								label: {
									$ifNull: ['$_id.alias', '$_id.type'],
								},
								value: '$value',
							},
						},
					},
				},
				{
					$project: {
						_id: 0,
					},
				},
			],
			{ readPreference: readSecondaryPreferred() },
		);
	}

	getConversationsByStatus(start: Date, end: Date): AggregationCursor<{ data: { label: string; value: number }[] }> {
		return this.col.aggregate(
			[
				{
					$match: {
						t: 'l',
						ts: {
							$gte: start,
							$lt: end,
						},
					},
				},
				{
					$group: {
						_id: null,
						open: {
							$sum: {
								$cond: [
									{
										$and: [
											{ $eq: ['$open', true] },
											{
												$or: [{ $not: ['$onHold'] }, { $eq: ['$onHold', false] }],
											},
											{ $ifNull: ['$servedBy', false] },
										],
									},
									1,
									0,
								],
							},
						},
						closed: {
							$sum: {
								$cond: [
									{
										$ifNull: ['$metrics.chatDuration', false],
									},
									1,
									0,
								],
							},
						},
						queued: {
							$sum: {
								$cond: [
									{
										$and: [
											{ $eq: ['$open', true] },
											{
												$eq: [
													{
														$ifNull: ['$servedBy', null],
													},
													null,
												],
											},
										],
									},
									1,
									0,
								],
							},
						},
						onhold: {
							$sum: {
								$cond: [{ $eq: ['$onHold', true] }, 1, 0],
							},
						},
					},
				},
				{
					$project: {
						_id: 0,
						data: [
							{
								label: 'Closed',
								value: '$closed',
							},
							{
								label: 'Open',
								value: '$open',
							},
							{
								label: 'Queued',
								value: '$queued',
							},
							{
								label: 'On_hold',
								value: '$onhold',
							},
						],
					},
				},
			],
			{ readPreference: readSecondaryPreferred() },
		);
	}

	getConversationsByDepartment(start: Date, end: Date): AggregationCursor<{ data: { label: string; value: number }[] }> {
		return this.col.aggregate(
			[
				{
					$match: {
						t: 'l',
						departmentId: {
							$exists: true,
						},
						ts: {
							$gte: start,
							$lt: end,
						},
					},
				},
				{
					$lookup: {
						from: 'rocketchat_livechat_department',
						localField: 'departmentId',
						foreignField: '_id',
						as: 'department',
					},
				},
				{
					$group: {
						_id: {
							$arrayElemAt: ['$department.name', 0],
						},
						Chats: {
							$sum: 1,
						},
					},
				},
				{
					$group: {
						_id: null,
						data: {
							$push: {
								label: '$_id',
								value: '$Chats',
							},
						},
					},
				},
				{
					$project: {
						_id: 0,
					},
				},
			],
			{ readPreference: readSecondaryPreferred() },
		);
	}

	getConversationsByTags(start: Date, end: Date): AggregationCursor<{ data: { label: string; value: number }[] }> {
		return this.col.aggregate(
			[
				{
					$match: {
						t: 'l',
						ts: {
							$gte: start,
							$lt: end,
						},
					},
				},
				{
					$group: {
						_id: {
							$ifNull: ['$tags', 'Tag_Unspecified'],
						},
						Chats: {
							$sum: 1,
						},
					},
				},
				{
					$unwind: '$_id',
				},
				{
					$group: {
						_id: null,
						data: {
							$push: {
								label: '$_id',
								value: '$Chats',
							},
						},
					},
				},
				{
					$project: {
						_id: 0,
					},
				},
			],
			{ readPreference: readSecondaryPreferred() },
		);
	}

	getConversationsByAgents(start: Date, end: Date): AggregationCursor<{ data: { label: string; value: number }[] }> {
		return this.col.aggregate(
			[
				{
					$match: {
						t: 'l',
						ts: {
							$gte: start,
							$lt: end,
						},
					},
				},
				{
					$group: {
						_id: {
							$ifNull: ['$servedBy._id', 'Agent_Unassigned'],
						},
						total: { $sum: 1 },
					},
				},
				{
					$lookup: {
						from: 'users',
						localField: '_id',
						foreignField: '_id',
						as: 'agent',
					},
				},
				{
					$set: {
						agent: { $first: '$agent' },
					},
				},
				{
					$addFields: {
						agentName: {
							$ifNull: ['$agent.name', '$_id'],
						},
					},
				},
				{
					$group: {
						_id: null,
						data: {
							$push: {
								label: '$agentName',
								value: '$total',
							},
						},
					},
				},
				{
					$project: {
						_id: 0,
					},
				},
			],
			{ readPreference: readSecondaryPreferred() },
		);
	}
}

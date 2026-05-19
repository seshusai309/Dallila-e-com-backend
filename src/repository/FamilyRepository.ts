import { FamilyMember, IFamilyMember, FamilyRelation } from '../models/FamilyMember';

export class FamilyRepository {
  async create(data: {
    headUserId: string;
    memberUserId: string;
    memberEmail: string;
    relation: FamilyRelation;
  }): Promise<IFamilyMember> {
    const doc = new FamilyMember({
      headUserId: data.headUserId,
      memberUserId: data.memberUserId,
      memberEmail: data.memberEmail,
      relation: data.relation,
    });
    return await doc.save();
  }

  async findByHeadId(headUserId: string): Promise<IFamilyMember[]> {
    return await FamilyMember.find({ headUserId })
      .populate('memberUserId', 'username email firstName lastName')
      .sort({ addedAt: 1 });
  }

  async findByMemberId(memberUserId: string): Promise<IFamilyMember | null> {
    return await FamilyMember.findOne({ memberUserId })
      .populate('headUserId', 'username email firstName lastName');
  }

  async countByHeadId(headUserId: string): Promise<number> {
    return await FamilyMember.countDocuments({ headUserId });
  }

  async existsForMember(memberUserId: string): Promise<boolean> {
    const count = await FamilyMember.countDocuments({ memberUserId });
    return count > 0;
  }
}

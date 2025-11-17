import { BaseFactory } from './BaseFactory';
import { AutoRoleModel, AutoRoleDocument } from '../../../src/models/AutoRole';
import { randomInt } from 'crypto';

export interface AutoRoleFactoryData {
  guildId: string;
  roleIds: string[];
}

export class AutoRoleFactory extends BaseFactory<AutoRoleDocument> {
  private static instance: AutoRoleFactory;

  static getInstance(): AutoRoleFactory {
    if (!AutoRoleFactory.instance) {
      AutoRoleFactory.instance = new AutoRoleFactory();
    }
    return AutoRoleFactory.instance;
  }

  build(overrides: Partial<AutoRoleFactoryData> = {}): AutoRoleDocument {
    const defaults: AutoRoleFactoryData = {
      guildId: overrides.guildId || BaseFactory.pick(BaseFactory.SAMPLE_GUILD_IDS),
      roleIds: overrides.roleIds || this.generateRoleIds()
    };

    const data = { ...defaults, ...overrides };
    return new AutoRoleModel(data) as AutoRoleDocument;
  }

  async create(overrides: Partial<AutoRoleFactoryData> = {}): Promise<AutoRoleDocument> {
    const autoRoleDoc = this.build(overrides);
    return await autoRoleDoc.save();
  }

  buildEmpty(overrides: Partial<AutoRoleFactoryData> = {}): AutoRoleDocument {
    return this.build({
      ...overrides,
      roleIds: []
    });
  }

  buildSingleRole(overrides: Partial<AutoRoleFactoryData> = {}): AutoRoleDocument {
    return this.build({
      ...overrides,
      roleIds: [this.generateRoleId()]
    });
  }

  buildMultipleRoles(roleCount: number = 3, overrides: Partial<AutoRoleFactoryData> = {}): AutoRoleDocument {
    const roleIds = [];
    for (let i = 0; i < roleCount; i++) {
      roleIds.push(this.generateRoleId());
    }

    return this.build({
      ...overrides,
      roleIds
    });
  }

  private generateRoleId(): string {
    return BaseFactory.pick(BaseFactory.SAMPLE_ROLE_IDS);
  }

  private generateRoleIds(): string[] {
    const roleCount = randomInt(1, 5);
    const roleIds = [];
    
    for (let i = 0; i < roleCount; i++) {
      roleIds.push(this.generateRoleId());
    }
    
    return roleIds;
  }

  async createBulk(count: number, baseOverrides: Partial<AutoRoleFactoryData> = {}): Promise<AutoRoleDocument[]> {
    const autoRoles = [];
    
    for (let i = 0; i < count; i++) {
      const overrides = {
        ...baseOverrides,
        guildId: baseOverrides.guildId || BaseFactory.pick(BaseFactory.SAMPLE_GUILD_IDS)
      };
      
      autoRoles.push(await this.create(overrides));
    }
    
    return autoRoles;
  }
}

export const autoRoleFactory = AutoRoleFactory.getInstance();
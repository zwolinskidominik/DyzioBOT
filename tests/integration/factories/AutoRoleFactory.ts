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

  /**
   * Build AutoRole object without saving to database
   */
  build(overrides: Partial<AutoRoleFactoryData> = {}): AutoRoleDocument {
    const defaults: AutoRoleFactoryData = {
      guildId: overrides.guildId || BaseFactory.pick(BaseFactory.SAMPLE_GUILD_IDS),
      roleIds: overrides.roleIds || this.generateRoleIds()
    };

    const data = { ...defaults, ...overrides };
    return new AutoRoleModel(data) as AutoRoleDocument;
  }

  /**
   * Create and save AutoRole to database
   */
  async create(overrides: Partial<AutoRoleFactoryData> = {}): Promise<AutoRoleDocument> {
    const autoRoleDoc = this.build(overrides);
    return await autoRoleDoc.save();
  }

  /**
   * Create AutoRole with empty role list
   */
  buildEmpty(overrides: Partial<AutoRoleFactoryData> = {}): AutoRoleDocument {
    return this.build({
      ...overrides,
      roleIds: []
    });
  }

  /**
   * Create AutoRole with single role
   */
  buildSingleRole(overrides: Partial<AutoRoleFactoryData> = {}): AutoRoleDocument {
    return this.build({
      ...overrides,
      roleIds: [this.generateRoleId()]
    });
  }

  /**
   * Create AutoRole with multiple roles
   */
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

  /**
   * Generate single role ID
   */
  private generateRoleId(): string {
    return BaseFactory.pick(BaseFactory.SAMPLE_ROLE_IDS);
  }

  /**
   * Generate default role IDs for testing
   */
  private generateRoleIds(): string[] {
    const roleCount = randomInt(1, 5); // 1-5 roles
    const roleIds = [];
    
    for (let i = 0; i < roleCount; i++) {
      roleIds.push(this.generateRoleId());
    }
    
    return roleIds;
  }

  /**
   * Create bulk AutoRole configurations for testing
   */
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

// Export singleton instance
export const autoRoleFactory = AutoRoleFactory.getInstance();
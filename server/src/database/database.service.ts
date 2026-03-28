import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { DataTypes } from 'sequelize';
import { User } from '../models/user.model';
import * as bcrypt from 'bcrypt';

@Injectable()
export class DatabaseService implements OnModuleInit {
  constructor(@InjectConnection() private sequelize: Sequelize) {}

  async onModuleInit() {
    try {
      await this.sequelize.authenticate();
      console.log('Database connection established successfully.');

      // Check if users table exists
      const tableExists = await this.checkTableExists('users');

      if (!tableExists) {
        console.log('Users table not found. Initializing database...');

        await this.initializeDatabase();
      } else {
        console.log('Database already initialized.');

        await this.ensureRoundTotalScoreColumn();
      }
    } catch (error) {
      console.error('Unable to connect to the database:', error);
      throw error;
    }
  }

  private async checkTableExists(tableName: string): Promise<boolean> {
    try {
      const queryInterface = this.sequelize.getQueryInterface();
      const tables = await queryInterface.showAllTables();
      return tables.includes(tableName);
    } catch (error) {
      return false;
    }
  }

  private async initializeDatabase() {
    try {
      // Create all tables
      await this.sequelize.sync({ force: true });
      console.log('Database tables created successfully.');

      // Create initial users
      await this.createInitialUsers();
      console.log('Initial users created successfully.');
    } catch (error) {
      console.error('Error initializing database:', error);
      throw error;
    }
  }

  private async ensureRoundTotalScoreColumn(): Promise<void> {
    const queryInterface = this.sequelize.getQueryInterface();
    const tables = await queryInterface.showAllTables();

    if (!tables.includes('rounds')) {
      return;
    }

    const description = await queryInterface.describeTable('rounds');

    if (!('total_score' in description)) {
      await queryInterface.addColumn('rounds', 'total_score', {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });

      console.log('Added column rounds.total_score');
    }
  }

  private async createInitialUsers() {
    const users = [
      {
        login: 'roma',
        password: 'roma',
        role: 'user'
      },
      {
        login: 'admin',
        password: 'admin',
        role: 'admin'
      }
    ];

    for (const userData of users) {
      const password_hash = await bcrypt.hash(userData.password, 10);

      await User.create({
        login: userData.login,
        password_hash,
        role: userData.role
      });
    }
  }
}
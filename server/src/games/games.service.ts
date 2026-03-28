import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Round } from '../models/round.model';
import { Score } from '../models/score.model';
import { User } from '../models/user.model';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class GamesService {
  constructor(
      @InjectConnection() private readonly sequelize: Sequelize,
      @InjectModel(Round)
      private roundModel: typeof Round,
      @InjectModel(Score)
      private scoreModel: typeof Score,
      @InjectModel(User)
      private userModel: typeof User,
  ) {}

  async getAllRounds(): Promise<Round[]> {
    return this.roundModel.findAll({
      where: { end_datetime: { [Op.gt]: new Date() } },
      order: [['start_datetime', 'ASC']],
    });
  }

  async getRoundByUuid(uuid: string): Promise<Round | null> {
    return this.roundModel.findByPk(uuid);
  }

  async getScoreByUserAndRound(userId: string, roundUuid: string): Promise<Score | null> {
    return this.scoreModel.findOne({
      where: {
        user: userId,
        round: roundUuid,
      },
    });
  }

  async getOrCreateScoreByUserAndRound(userId: string, roundUuid: string): Promise<Score> {
    const [scoreRecord] = await this.scoreModel.findOrCreate({
      where: {
        user: userId,
        round: roundUuid,
      },
      defaults: {
        user: userId,
        round: roundUuid,
        taps: 0,
      },
    });
    return scoreRecord;
  }

  async createRound(): Promise<Round> {
    const now = new Date();
    const cooldownMinutes = parseInt(process.env.COOLDOWN_DURATION || '1', 10);
    const roundMinutes = parseInt(process.env.ROUND_DURATION || '1', 10);
    const toMs = (minutes: number) => minutes * 60 * 1000;
    const cooldownDuration = toMs(cooldownMinutes);
    const roundDuration = toMs(roundMinutes);

    const startDatetime = new Date(now.getTime() + cooldownDuration);
    const endDatetime = new Date(now.getTime() + cooldownDuration + roundDuration);

    return this.roundModel.create({
      uuid: uuidv4(),
      start_datetime: startDatetime,
      end_datetime: endDatetime,
      status: 'scheduled',
      total_score: 0,
    });
  }

  scoreFromTapsCount(taps: number): number {
    return taps + 9 * Math.floor(taps / 11);
  }

  pointsForTapNumber(tapIndexOneBased: number): number {
    return tapIndexOneBased % 11 === 0 ? 10 : 1;
  }

  async processTap(userId: string, roundUuid: string, role: string): Promise<{ score: number }> {
    if (role === 'nikita') {
      return { score: 0 };
    }

    return this.sequelize.transaction(async (transaction) => {
      const round = await this.roundModel.findByPk(roundUuid, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!round) {
        throw new BadRequestException('Round not found');
      }

      const now = new Date();
      if (now < round.start_datetime || now >= round.end_datetime) {
        throw new BadRequestException('Round is not active');
      }

      const [scoreRow] = await this.scoreModel.findOrCreate({
        where: { user: userId, round: roundUuid },
        defaults: { user: userId, round: roundUuid, taps: 0 },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      const newTaps = scoreRow.taps + 1;
      const pointsThisTap = this.pointsForTapNumber(newTaps);

      await scoreRow.update({ taps: newTaps }, { transaction });
      await round.increment('total_score', { by: pointsThisTap, transaction });

      return { score: this.scoreFromTapsCount(newTaps) };
    });
  }

  async getRoundSummary(roundUuid: string): Promise<{
    totalScore: number;
    bestPlayer: { username: string; score: number } | null;
  }> {
    const round = await this.roundModel.findByPk(roundUuid);
    const totalScore = round?.total_score ?? 0;

    const scores = await this.scoreModel.findAll({
      where: { round: roundUuid },
      include: [
        {
          model: this.userModel,
          as: 'userRef',
          attributes: ['login', 'role'],
          required: true,
        },
      ],
    });

    let bestPlayer: { username: string; score: number } | null = null;
    let bestPoints = -1;

    for (const score of scores) {
      if (score.userRef.role === 'nikita') {
        continue;
      }
      const pts = this.scoreFromTapsCount(score.taps);
      if (pts > bestPoints) {
        bestPoints = pts;
        bestPlayer = { username: score.userRef.login, score: pts };
      }
    }

    return { totalScore, bestPlayer };
  }

  isRoundFinished(round: Round): boolean {
    const now = new Date();
    return now >= round.end_datetime;
  }
}
import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatorWalletEntity } from './creator-wallet.entity';

const EVM_ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;

@Injectable()
export class CryptoWalletService {
  private readonly logger = new Logger(CryptoWalletService.name);

  constructor(
    @InjectRepository(CreatorWalletEntity)
    private readonly walletRepo: Repository<CreatorWalletEntity>,
  ) {}

  validateEvmAddress(address: string): boolean {
    return EVM_ADDRESS_REGEX.test(address);
  }

  async createOrUpdateWallet(
    userId: string,
    agentId: string,
    network: string,
    address: string,
  ): Promise<CreatorWalletEntity> {
    if (!this.validateEvmAddress(address)) {
      throw new BadRequestException('Invalid wallet address format. Must be a valid EVM address (0x...)');
    }

    let wallet = await this.walletRepo.findOne({
      where: { agentId, network },
    });

    if (wallet) {
      if (wallet.userId !== userId) {
        throw new BadRequestException('You do not own this wallet entry');
      }
      wallet.address = address;
      wallet.updatedAt = new Date();
    } else {
      wallet = this.walletRepo.create({
        userId,
        agentId,
        network,
        address,
        isPrimary: true,
      });
    }

    return this.walletRepo.save(wallet);
  }

  async getWalletByAgent(
    agentId: string,
    network?: string,
  ): Promise<CreatorWalletEntity | null> {
    const where: any = { agentId };
    if (network) {
      where.network = network;
    } else {
      where.isPrimary = true;
    }
    return this.walletRepo.findOne({ where });
  }

  async deleteWallet(walletId: string, userId: string): Promise<void> {
    const wallet = await this.walletRepo.findOne({ where: { id: walletId } });
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }
    if (wallet.userId !== userId) {
      throw new BadRequestException('You do not own this wallet');
    }
    await this.walletRepo.remove(wallet);
  }

  async deleteWalletByAgent(agentId: string, userId: string): Promise<void> {
    const wallet = await this.walletRepo.findOne({ where: { agentId } });
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }
    if (wallet.userId !== userId) {
      throw new BadRequestException('You do not own this wallet');
    }
    await this.walletRepo.remove(wallet);
  }
}

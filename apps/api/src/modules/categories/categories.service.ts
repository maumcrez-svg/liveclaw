import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CategoryEntity } from './category.entity';
import { CreateCategoryDto, UpdateCategoryDto } from './categories.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(CategoryEntity)
    private readonly categoryRepo: Repository<CategoryEntity>,
  ) {}

  async findAll(sort?: string): Promise<(CategoryEntity & { viewerCount?: number })[]> {
    if (sort === 'viewers') {
      // Join with agents + streams to get live viewer counts per category
      const results = await this.categoryRepo
        .createQueryBuilder('c')
        .leftJoin('agents', 'a', 'a.default_category_id = c.id AND a.status = :status', { status: 'live' })
        .leftJoin('streams', 's', 's.agent_id = a.id AND s.is_live = true')
        .addSelect('COALESCE(SUM(s.current_viewers), 0)', 'viewer_count')
        .groupBy('c.id')
        .orderBy('viewer_count', 'DESC')
        .addOrderBy('c.name', 'ASC')
        .getRawAndEntities();

      return results.entities.map((entity, i) => ({
        ...entity,
        viewerCount: parseInt(results.raw[i]?.viewer_count || '0', 10),
      }));
    }
    return this.categoryRepo.find({ order: { name: 'ASC' } });
  }

  async findBySlug(slug: string): Promise<CategoryEntity> {
    const category = await this.categoryRepo.findOne({ where: { slug } });
    if (!category) {
      throw new NotFoundException(`Category with slug "${slug}" not found`);
    }
    return category;
  }

  async findById(id: string): Promise<CategoryEntity> {
    const category = await this.categoryRepo.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException(`Category ${id} not found`);
    }
    return category;
  }

  async create(dto: CreateCategoryDto): Promise<CategoryEntity> {
    const existing = await this.categoryRepo.findOne({
      where: [{ slug: dto.slug }, { name: dto.name }],
    });
    if (existing) {
      throw new ConflictException(
        `A category with that name or slug already exists`,
      );
    }
    const category = this.categoryRepo.create({
      name: dto.name,
      slug: dto.slug,
      iconUrl: dto.iconUrl ?? null,
      imageUrl: dto.imageUrl ?? null,
    });
    return this.categoryRepo.save(category);
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryEntity> {
    const category = await this.findById(id);
    Object.assign(category, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.slug !== undefined && { slug: dto.slug }),
      ...(dto.iconUrl !== undefined && { iconUrl: dto.iconUrl }),
      ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
    });
    return this.categoryRepo.save(category);
  }

  async delete(id: string): Promise<void> {
    const category = await this.findById(id);
    await this.categoryRepo.remove(category);
  }
}

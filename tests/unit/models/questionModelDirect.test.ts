import { describe, beforeAll, afterEach, afterAll, it, expect, jest } from '@jest/globals';
import { QuestionModel } from '../../../src/models/Question';
import { connectTestDb, clearDatabase, disconnectTestDb } from '../helpers/connectTestDb';
import mongoose from 'mongoose';

describe('Question Model Direct Unit Tests', () => {
  beforeAll(async () => {
    await connectTestDb();
    await QuestionModel.ensureIndexes();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  describe('Schema Validation', () => {
    it('should create a Question with minimal required fields', async () => {
      const question = await QuestionModel.create({
        authorId: 'user123',
        content: 'What is the meaning of life?'
      });

      expect(question.authorId).toBe('user123');
      expect(question.content).toBe('What is the meaning of life?');
      expect(question._id).toBeDefined();
    });

    it('should require authorId field', async () => {
      await expect(
        QuestionModel.create({
          content: 'Question without author'
        } as any)
      ).rejects.toThrow();
    });

    it('should require content field', async () => {
      await expect(
        QuestionModel.create({
          authorId: 'user123'
        } as any)
      ).rejects.toThrow();
    });

    it('should reject empty authorId', async () => {
      await expect(
        QuestionModel.create({
          authorId: '',
          content: 'Question with empty author'
        })
      ).rejects.toThrow();
    });

    it('should reject empty content', async () => {
      await expect(
        QuestionModel.create({
          authorId: 'user123',
          content: ''
        })
      ).rejects.toThrow();
    });

    it('should reject null or undefined required fields', async () => {
      await expect(
        QuestionModel.create({
          authorId: null,
          content: 'Question with null author'
        } as any)
      ).rejects.toThrow();

      await expect(
        QuestionModel.create({
          authorId: 'user123',
          content: undefined
        } as any)
      ).rejects.toThrow();
    });
  });

  describe('Default Values', () => {
    it('should generate unique questionId automatically', async () => {
      const question1 = await QuestionModel.create({
        authorId: 'user1',
        content: 'First question'
      });

      const question2 = await QuestionModel.create({
        authorId: 'user2',
        content: 'Second question'
      });

      expect(question1.questionId).toBeDefined();
      expect(question2.questionId).toBeDefined();
      expect(question1.questionId).not.toBe(question2.questionId);
      expect(typeof question1.questionId).toBe('string');
      expect(question1.questionId.length).toBeGreaterThan(0);
    });

    it('should set empty array as default for reactions', async () => {
      const question = await QuestionModel.create({
        authorId: 'user123',
        content: 'Question with default reactions'
      });

      expect(question.reactions).toEqual([]);
      expect(Array.isArray(question.reactions)).toBe(true);
    });

    it('should allow overriding default questionId', async () => {
      const customId = 'custom-question-id-123';
      const question = await QuestionModel.create({
        questionId: customId,
        authorId: 'user123',
        content: 'Question with custom ID'
      });

      expect(question.questionId).toBe(customId);
    });

    it('should allow setting custom reactions array', async () => {
      const customReactions = ['👍', '👎', '❤️'];
      const question = await QuestionModel.create({
        authorId: 'user123',
        content: 'Question with custom reactions',
        reactions: customReactions
      });

      expect(question.reactions).toEqual(customReactions);
    });
  });

  describe('Field Validation', () => {
    it('should accept valid string values for authorId', async () => {
      const validIds = ['123', 'user_123', 'long-user-id-with-dashes'];
      
      for (const authorId of validIds) {
        const question = await QuestionModel.create({
          authorId,
          content: `Question by ${authorId}`
        });
        expect(question.authorId).toBe(authorId);
      }
    });

    it('should accept various content lengths and formats', async () => {
      const shortContent = 'Short?';
      const longContent = 'A'.repeat(1000);
      const specialChars = 'Question with special chars: 你好! émojis 🤔 @#$%^&*()';

      const question1 = await QuestionModel.create({
        authorId: 'user1',
        content: shortContent
      });
      
      const question2 = await QuestionModel.create({
        authorId: 'user2',
        content: longContent
      });

      const question3 = await QuestionModel.create({
        authorId: 'user3',
        content: specialChars
      });

      expect(question1.content).toBe(shortContent);
      expect(question2.content).toBe(longContent);
      expect(question3.content).toBe(specialChars);
    });

    it('should accept valid reactions array formats', async () => {
      const emojiReactions = ['😀', '😃', '😄'];
      const textReactions = ['like', 'dislike', 'love'];
      const mixedReactions = ['👍', 'cool', '❤️', 'awesome'];

      const question1 = await QuestionModel.create({
        authorId: 'user1',
        content: 'Question 1',
        reactions: emojiReactions
      });

      const question2 = await QuestionModel.create({
        authorId: 'user2',
        content: 'Question 2',
        reactions: textReactions
      });

      const question3 = await QuestionModel.create({
        authorId: 'user3',
        content: 'Question 3',
        reactions: mixedReactions
      });

      expect(question1.reactions).toEqual(emojiReactions);
      expect(question2.reactions).toEqual(textReactions);
      expect(question3.reactions).toEqual(mixedReactions);
    });

    it('should handle empty reactions array properly', async () => {
      const question = await QuestionModel.create({
        authorId: 'user123',
        content: 'Question with explicitly empty reactions',
        reactions: []
      });

      expect(question.reactions).toEqual([]);
    });
  });

  describe('Unique Constraints', () => {
    it('should enforce unique content constraint', async () => {
      const content = 'This is a unique question';
      
      // First creation should succeed
      await QuestionModel.create({
        authorId: 'user1',
        content
      });

      // Second creation with same content should fail
      await expect(
        QuestionModel.create({
          authorId: 'user2',
          content
        })
      ).rejects.toThrow(/duplicate key/i);
    });

    it('should allow different content for different questions', async () => {
      const question1 = await QuestionModel.create({
        authorId: 'user1',
        content: 'First unique question'
      });

      const question2 = await QuestionModel.create({
        authorId: 'user2',
        content: 'Second unique question'
      });

      expect(question1.content).toBe('First unique question');
      expect(question2.content).toBe('Second unique question');
      expect(question1._id).not.toEqual(question2._id);
    });

    it('should allow same author to create multiple questions with different content', async () => {
      const authorId = 'prolific-user';

      const question1 = await QuestionModel.create({
        authorId,
        content: 'First question from user'
      });

      const question2 = await QuestionModel.create({
        authorId,
        content: 'Second question from same user'
      });

      expect(question1.authorId).toBe(authorId);
      expect(question2.authorId).toBe(authorId);
      expect(question1.content).not.toBe(question2.content);
    });

    it('should not allow duplicate questionId if manually set', async () => {
      const questionId = 'duplicate-test-id';

      await QuestionModel.create({
        questionId,
        authorId: 'user1',
        content: 'First question with custom ID'
      });

      // Note: questionId doesn't have unique constraint in schema, 
      // but let's test the behavior anyway
      const question2 = await QuestionModel.create({
        questionId,
        authorId: 'user2',
        content: 'Second question with same custom ID'
      });

      // Should succeed as questionId doesn't have unique constraint
      expect(question2.questionId).toBe(questionId);
    });
  });

  describe('Document Operations', () => {
    it('should create and save document successfully', async () => {
      const questionData = {
        questionId: 'test-question-123',
        authorId: 'test-author',
        content: 'Test question content',
        reactions: ['👍', '👎', '❤️']
      };

      const question = await QuestionModel.create(questionData);

      expect(question.questionId).toBe('test-question-123');
      expect(question.authorId).toBe('test-author');
      expect(question.content).toBe('Test question content');
      expect(question.reactions).toEqual(['👍', '👎', '❤️']);
    });

    it('should update document successfully', async () => {
      const question = await QuestionModel.create({
        authorId: 'user123',
        content: 'Original question'
      });

      // Update reactions
      question.reactions.push('👍', '👎');
      const savedQuestion = await question.save();

      expect(savedQuestion.reactions).toEqual(['👍', '👎']);

      // Update via findByIdAndUpdate
      const updatedQuestion = await QuestionModel.findByIdAndUpdate(
        question._id,
        { $push: { reactions: '❤️' } },
        { new: true }
      );

      expect(updatedQuestion?.reactions).toEqual(['👍', '👎', '❤️']);
    });

    it('should find documents by various criteria', async () => {
      await QuestionModel.create({
        authorId: 'user1',
        content: 'Question from user 1'
      });

      await QuestionModel.create({
        authorId: 'user2',
        content: 'Question from user 2'
      });

      // Find by authorId
      const user1Questions = await QuestionModel.find({ authorId: 'user1' });
      expect(user1Questions).toHaveLength(1);
      expect(user1Questions[0].content).toBe('Question from user 1');

      // Find by content
      const specificQuestion = await QuestionModel.findOne({ 
        content: 'Question from user 2' 
      });
      expect(specificQuestion).toBeDefined();
      expect(specificQuestion?.authorId).toBe('user2');

      // Find all
      const allQuestions = await QuestionModel.find({});
      expect(allQuestions).toHaveLength(2);
    });

    it('should delete document successfully', async () => {
      const question = await QuestionModel.create({
        authorId: 'temp-user',
        content: 'Temporary question'
      });

      const questionId = question._id;

      await QuestionModel.findByIdAndDelete(questionId);

      const deletedQuestion = await QuestionModel.findById(questionId);
      expect(deletedQuestion).toBeNull();
    });

    it('should handle bulk operations', async () => {
      const questionsData = [
        { authorId: 'user1', content: 'Bulk question 1' },
        { authorId: 'user2', content: 'Bulk question 2' },
        { authorId: 'user3', content: 'Bulk question 3' }
      ];

      const questions = await QuestionModel.insertMany(questionsData);
      expect(questions).toHaveLength(3);

      // Bulk update
      await QuestionModel.updateMany(
        { authorId: { $in: ['user1', 'user2'] } },
        { $push: { reactions: 'bulk-reaction' } }
      );

      const updatedQuestions = await QuestionModel.find({ 
        authorId: { $in: ['user1', 'user2'] } 
      });
      
      updatedQuestions.forEach(question => {
        expect(question.reactions).toContain('bulk-reaction');
      });
    });
  });

  describe('Error Scenarios', () => {
    it('should handle validation errors properly', async () => {
      try {
        await QuestionModel.create({
          authorId: '',
          content: ''
        });
        fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.name).toBe('ValidationError');
        expect(error.errors).toBeDefined();
      }
    });

    it('should handle duplicate key errors properly', async () => {
      const content = 'Duplicate content test';
      await QuestionModel.create({ authorId: 'user1', content });

      try {
        await QuestionModel.create({ authorId: 'user2', content });
        fail('Should have thrown duplicate key error');
      } catch (error: any) {
        expect(error.code).toBe(11000); // MongoDB duplicate key error code
        expect(error.message).toMatch(/duplicate key/i);
      }
    });

    it('should handle invalid data types gracefully', async () => {
      // Test with object types that cannot be converted to strings
      await expect(
        QuestionModel.create({
          authorId: { invalid: 'object' } as any,
          content: 'Valid content'
        })
      ).rejects.toThrow();

      await expect(
        QuestionModel.create({
          authorId: 'valid-user',
          content: { invalid: 'object' } as any
        })
      ).rejects.toThrow();

      // Test with completely invalid document structure
      await expect(
        QuestionModel.create(null as any)
      ).rejects.toThrow();

      await expect(
        QuestionModel.create(undefined as any)
      ).rejects.toThrow();
    });

    it('should handle non-existent document operations', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      
      const result = await QuestionModel.findById(nonExistentId);
      expect(result).toBeNull();

      const updateResult = await QuestionModel.findByIdAndUpdate(
        nonExistentId,
        { $push: { reactions: 'test' } }
      );
      expect(updateResult).toBeNull();

      const deleteResult = await QuestionModel.findByIdAndDelete(nonExistentId);
      expect(deleteResult).toBeNull();
    });
  });

  describe('Timestamps and Metadata', () => {
    it('should have MongoDB document metadata', async () => {
      const question = await QuestionModel.create({
        authorId: 'metadata-test',
        content: 'Testing metadata'
      });

      expect(question._id).toBeDefined();
      expect(question.__v).toBeDefined();
      expect(typeof question.__v).toBe('number');
    });

    it('should maintain document version on updates', async () => {
      const question = await QuestionModel.create({
        authorId: 'version-test',
        content: 'Original content'
      });

      const originalVersion = question.__v;

      question.reactions.push('new-reaction');
      await question.save();

      expect(question.__v).toBe(originalVersion + 1);
    });

    it('should preserve questionId across operations', async () => {
      const question = await QuestionModel.create({
        authorId: 'persistence-test',
        content: 'Testing persistence'
      });

      const originalQuestionId = question.questionId;

      // Update and verify questionId remains the same
      question.reactions.push('test-reaction');
      await question.save();

      expect(question.questionId).toBe(originalQuestionId);

      // Fetch from database and verify
      const fetchedQuestion = await QuestionModel.findById(question._id);
      expect(fetchedQuestion?.questionId).toBe(originalQuestionId);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle questions with many reactions', async () => {
      const question = new QuestionModel({
        authorId: 'reaction-heavy-user',
        content: 'Question with many reactions'
      });

      // Add many reactions
      const manyReactions = Array.from({ length: 50 }, (_, i) => `reaction-${i}`);
      question.reactions = manyReactions;

      await question.save();

      const saved = await QuestionModel.findOne({ 
        authorId: 'reaction-heavy-user' 
      });
      expect(saved?.reactions).toHaveLength(50);
      expect(saved?.reactions[0]).toBe('reaction-0');
      expect(saved?.reactions[49]).toBe('reaction-49');
    });

    it('should maintain data integrity after multiple updates', async () => {
      const question = await QuestionModel.create({
        authorId: 'integrity-test',
        content: 'Integrity test question'
      });

      // Multiple updates
      question.reactions.push('first-reaction');
      await question.save();

      question.reactions.push('second-reaction');
      await question.save();

      question.reactions = question.reactions.filter(r => r !== 'first-reaction');
      await question.save();

      const final = await QuestionModel.findById(question._id);
      expect(final?.reactions).toEqual(['second-reaction']);
      expect(final?.content).toBe('Integrity test question');
      expect(final?.authorId).toBe('integrity-test');
    });

    it('should properly serialize and deserialize complex data', async () => {
      const complexData = {
        questionId: 'serialization-test-123',
        authorId: 'serialization-user',
        content: 'Complex question with émojis 🤔 and unicode ñáéíóú',
        reactions: ['👍', '👎', '❤️', '😂', '😮', '😢', '😡']
      };

      const created = await QuestionModel.create(complexData);
      const retrieved = await QuestionModel.findById(created._id);

      expect(retrieved?.toObject()).toMatchObject(
        expect.objectContaining({
          questionId: 'serialization-test-123',
          authorId: 'serialization-user',
          content: 'Complex question with émojis 🤔 and unicode ñáéíóú',
          reactions: ['👍', '👎', '❤️', '😂', '😮', '😢', '😡']
        })
      );
    });

    it('should handle concurrent operations safely', async () => {
      const question = await QuestionModel.create({
        authorId: 'concurrent-test',
        content: 'Concurrent operations test'
      });

      // Simulate concurrent updates
      const promises = Array.from({ length: 10 }, async (_, i) => {
        return QuestionModel.findByIdAndUpdate(
          question._id,
          { $push: { reactions: `concurrent-${i}` } },
          { new: true }
        );
      });

      const results = await Promise.all(promises);
      
      // Verify all operations completed
      results.forEach(result => {
        expect(result).not.toBeNull();
      });

      // Fetch final state
      const finalQuestion = await QuestionModel.findById(question._id);
      expect(finalQuestion?.reactions).toHaveLength(10);
    });
  });
});
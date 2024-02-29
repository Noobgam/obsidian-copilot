import * as Obsidian from 'obsidian';
import {
  getNotesFromPath,
  getTagsFromNote,
  isFolderMatch,
  processVariableNameForNotePath,
} from '@/utils';
import { TFile } from 'obsidian';

describe('isFolderMatch', () => {
  it('should return file from the folder name 1', async () => {
    const match = isFolderMatch('test2/note3.md', 'test2');
    expect(match).toEqual(true);
  });

  it('should return file from the folder name 2', async () => {
    const match = isFolderMatch('test/test2/note1.md', 'test2');
    expect(match).toEqual(true);
  });

  it('should return file from the folder name 3', async () => {
    const match = isFolderMatch('test/test2/note1.md', 'test');
    expect(match).toEqual(true);
  });

  it('should not return file from the folder name 1', async () => {
    const match = isFolderMatch('test/test2/note1.md', 'tes');
    expect(match).toEqual(false);
  });

  it('should return file from file name 1', async () => {
    const match = isFolderMatch('test/test2/note1.md', 'note1.md');
    expect(match).toEqual(true);
  });
});

describe('Vault', () => {
  it('should return all markdown files', async () => {
    const vault = new Obsidian.Vault();
    const files = vault.getMarkdownFiles();
    expect(files).toEqual([
      { path: 'test/test2/note1.md' },
      { path: 'test/note2.md' },
      { path: 'test2/note3.md' },
      { path: 'note4.md' },
    ]);
  });
});

describe('getNotesFromPath', () => {
  it('should return all markdown files', async () => {
    const vault = new Obsidian.Vault();
    const files = await getNotesFromPath(vault, '/');
    expect(files).toEqual([
      { path: 'test/test2/note1.md' },
      { path: 'test/note2.md' },
      { path: 'test2/note3.md' },
      { path: 'note4.md' },
    ]);
  });

  it('should return filtered markdown files 1', async () => {
    const vault = new Obsidian.Vault();
    const files = await getNotesFromPath(vault, 'test2');
    expect(files).toEqual([
      { path: 'test/test2/note1.md' },
      { path: 'test2/note3.md' },
    ]);
  });

  it('should return filtered markdown files 2', async () => {
    const vault = new Obsidian.Vault();
    const files = await getNotesFromPath(vault, 'test');
    expect(files).toEqual([
      { path: 'test/test2/note1.md' },
      { path: 'test/note2.md' },
    ]);
  });

  it('should return filtered markdown files 3', async () => {
    const vault = new Obsidian.Vault();
    const files = await getNotesFromPath(vault, 'note4.md');
    expect(files).toEqual([{ path: 'note4.md' }]);
  });

  it('should return filtered markdown files 4', async () => {
    const vault = new Obsidian.Vault();
    const files = await getNotesFromPath(vault, '/test');
    expect(files).toEqual([
      { path: 'test/test2/note1.md' },
      { path: 'test/note2.md' },
    ]);
  });

  it('should not return markdown files', async () => {
    const vault = new Obsidian.Vault();
    const files = await getNotesFromPath(vault, '');
    expect(files).toEqual([]);
  });

  describe('processVariableNameForNotePath', () => {
    it('should return the note md filename', () => {
      const variableName = processVariableNameForNotePath('[[test]]');
      expect(variableName).toEqual('test.md');
    });

    it('should return the note md filename with extra spaces 1', () => {
      const variableName = processVariableNameForNotePath(' [[  test]]');
      expect(variableName).toEqual('test.md');
    });

    it('should return the note md filename with extra spaces 2', () => {
      const variableName = processVariableNameForNotePath('[[ test   ]] ');
      expect(variableName).toEqual('test.md');
    });

    it('should return the note md filename with extra spaces 2', () => {
      const variableName = processVariableNameForNotePath(
        ' [[ test note   ]] '
      );
      expect(variableName).toEqual('test note.md');
    });

    it('should return the note md filename with extra spaces 2', () => {
      const variableName = processVariableNameForNotePath(
        ' [[    test_note note   ]] '
      );
      expect(variableName).toEqual('test_note note.md');
    });

    it('should return folder path with leading slash', () => {
      const variableName = processVariableNameForNotePath('/testfolder');
      expect(variableName).toEqual('/testfolder');
    });

    it('should return folder path without slash', () => {
      const variableName = processVariableNameForNotePath('testfolder');
      expect(variableName).toEqual('testfolder');
    });

    it('should return folder path with trailing slash', () => {
      const variableName = processVariableNameForNotePath('testfolder/');
      expect(variableName).toEqual('testfolder/');
    });

    it('should return folder path with leading spaces', () => {
      const variableName = processVariableNameForNotePath('  testfolder ');
      expect(variableName).toEqual('testfolder');
    });
  });
});

describe('getNoteTags', () => {
  it('returns tags from frontmatter and content', async () => {
    const tags = await getTagsFromNote(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { path: 'note4.md' } as any as TFile,
      app
    );
    expect(tags).toEqual(['tag1', 'tag4', 'some_hashtag']);
  });
});

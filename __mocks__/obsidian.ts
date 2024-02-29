// __mocks__/obsidian.js

import { CachedMetadata, Pos, TFile } from 'obsidian';

type MockedFile = {
  path: string;
  content: string;
  cachedMetadata: CachedMetadata;
};

const mockedFiles: MockedFile[] = [
  {
    path: 'test/test2/note1.md',
    content: '---\ntags: [tag1, tag2]\n---\nContent of note1',
    cachedMetadata: {
      frontmatter: {
        tags: ['tag1', 'tag2'],
      },
    },
  },
  {
    path: 'test/note2.md',
    content: '---\ntags: [tag2, tag3]\n---\nContent of note2',
    cachedMetadata: {
      frontmatter: {
        tags: ['tag2', 'tag3'],
      },
    },
  },
  {
    path: 'test2/note3.md',
    content: '',
    cachedMetadata: {},
  },
  {
    path: 'note4.md',
    content: '---\ntags: [tag1, tag4]\n---\nContent of note4. #some_hashtag',
    cachedMetadata: {
      frontmatter: {
        // simulate mixed tag style from obsidian
        tags: ['tag1', '#tag4'],
      },
      tags: [
        {
          tag: 'some_hashtag',
          // ew. Benefits of using ts mocks, haha.
          position: undefined as any as Pos,
        },
      ],
    },
  },
];

const vault = jest.fn().mockImplementation(() => {
  return {
    getMarkdownFiles: jest.fn().mockImplementation(() => {
      // Return an array of mock markdown file objects
      return mockedFiles.map(({ path }) => {
        return { path };
      });
    }),
    cachedRead: jest.fn().mockImplementation((file: TFile) => {
      return Promise.resolve(
        mockedFiles.find((f) => f.path === file.path)?.content
      );
    }),
  };
});

const metadataCache = {
  getFileCache: (file: TFile) => {
    const correspondingFile = mockedFiles.find((f) => f.path === file.path);
    return correspondingFile?.cachedMetadata;
  },
};

module.exports = {
  Vault: vault,
  Platform: {
    isDesktop: true,
  },
};

// ugly, but we can't get away from that until we remove global usages (do we want to?)
global.app = {
  // @ts-ignore
  vault: vault,
  // @ts-ignore
  metadataCache: metadataCache,
};

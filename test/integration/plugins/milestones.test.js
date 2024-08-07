import fs from 'fs'
import { CREATED, NO_CONTENT, OK } from 'http-status-codes'
import Settings from '../../../lib/settings'
import { buildTriggerEvent, initializeNock, loadInstance, repository, teardownNock } from '../common'

describe('milestones plugin', function () {
  let probot, githubScope

  beforeEach(() => {
    githubScope = initializeNock()
    probot = loadInstance()
  })

  afterEach(() => {
    teardownNock(githubScope)
  })

  it('syncs milestones', async () => {
    const pathToConfig = new URL('../../fixtures/milestones-config.yml', import.meta.url)
    const configFile = Buffer.from(fs.readFileSync(pathToConfig, 'utf8'))
    const config = configFile.toString()
    githubScope
      .get(`/repos/${repository.owner.name}/${repository.name}/contents/${encodeURIComponent(Settings.FILE_NAME)}`)
      .reply(OK, config)
    githubScope.patch(`/repos/${repository.owner.name}/${repository.name}`).reply(200)
    githubScope.get(`/repos/${repository.owner.name}/${repository.name}/milestones?per_page=100&state=all`).reply(OK, [
      {
        number: 42,
        title: 'existing-milestone',
        description: 'this milestone should get updated',
        state: 'open'
      },
      {
        number: 8,
        title: 'old-milestone',
        description: 'this milestone should get deleted',
        state: 'closed'
      }
    ])
    githubScope
      .post(`/repos/${repository.owner.name}/${repository.name}/milestones`, body => {
        expect(body).toMatchObject({
          title: 'new-milestone',
          description: 'this milestone should get added',
          state: 'open'
        })
        return true
      })
      .reply(CREATED)
    githubScope
      .patch(`/repos/${repository.owner.name}/${repository.name}/milestones/42`, body => {
        expect(body).toMatchObject({
          title: 'existing-milestone',
          description: 'this milestone should get updated',
          state: 'closed'
        })
        return true
      })
      .reply(OK)
    githubScope.delete(`/repos/${repository.owner.name}/${repository.name}/milestones/8`).reply(NO_CONTENT)

    await probot.receive(buildTriggerEvent())
  })
})

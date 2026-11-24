import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CampaignCloud, CloudError } from '../src/campaigns/client.ts';
import { campaignApi } from '../src/campaigns/api.ts';
import { campaignEnvironment } from './fixtures/campaign-database.ts';
import { demoCampaign } from '../src/galaxy/model.ts';

function fixture() {
  const { env, database } = campaignEnvironment(); env.ROOM_DM_EMAIL='a@example.invalid'; let account='a', loseResponse=false;
  const request=async <T>(path='',method='GET',body?:unknown):Promise<T>=>{
    const response=await campaignApi(new Request('https://test.invalid/api/campaigns'+path, {
      method, headers:{'oai-authenticated-user-id':account,'oai-authenticated-user-email':account+'@example.invalid',Origin:'https://test.invalid','Content-Type':'application/json'},
      body: body === undefined ? undefined : JSON.stringify(body),
    }),env);
    const data=await response.json();
    if(!response.ok)throw new CloudError(response.status,data.error);
    if(loseResponse && method==='POST'){loseResponse=false;throw Error('Connection lost after commit');}
    return data;
  };
  return { cloud:new CampaignCloud(request),request,database, switchAccount:(value:string)=>{account=value;}, lose:()=>{loseResponse=true;} };
}
test('client retries the captured upload once without banking newer edits or duplicating saves',async()=>{
  const h=fixture();await h.cloud.refresh();const c=demoCampaign('Captured snapshot');h.lose();
  await h.cloud.run(()=>h.cloud.save(c,false)); assert.ok(h.cloud.pending);
  c.name='Later edit';await h.cloud.run(()=>h.cloud.retry(c.id));assert.equal(h.cloud.pending,null);
  const restored=await h.cloud.read(h.cloud.selected);assert.equal(restored.campaigns[0].name,'Captured snapshot');
  assert.equal(h.database.prepare('SELECT count(*) AS n FROM campaign_saves').get()!.n,1);
});
test('conflicting client save retains local changes and offers an independent copy',async()=>{
  const h=fixture();await h.cloud.refresh();const c=demoCampaign('First');await h.cloud.save(c,false);
  const old=h.cloud.saves[0];
  await h.request('/'+old.id,'PUT',{id:old.id,operationId:crypto.randomUUID(),revision:old.revision,account:h.cloud.account,archive:{version:2,selected:c.id,campaigns:[c]}});
  c.name='Local unshared changes';await h.cloud.run(()=>h.cloud.save(c,true));
  assert.equal(h.cloud.conflict,true);assert.equal(c.name,'Local unshared changes');
  await h.cloud.run(()=>h.cloud.save(c,false));assert.equal(h.cloud.saves.length,2);
});
test('switching to an unauthorized account clears cloud data and controls, and DM access can recover',async()=>{
  const h=fixture();await h.cloud.refresh();const c=demoCampaign();await h.cloud.save(c,false);
  h.switchAccount('b');await h.cloud.run(()=>h.cloud.save(c,true));
  assert.equal(h.cloud.accessDenied,true);assert.equal(h.cloud.account,'');
  assert.equal(h.cloud.selected,'');assert.equal(h.cloud.pending,null);assert.equal(h.cloud.saves.length,0);
  assert.match(h.cloud.status,/limited to the signed-in DM/);
  h.switchAccount('a');await h.cloud.run(()=>h.cloud.refresh());
  assert.equal(h.cloud.accessDenied,false);assert.equal(h.cloud.saves.length,1);
  h.switchAccount('');await h.cloud.run(()=>h.cloud.refresh());assert.equal(h.cloud.signedOut,true);assert.equal(h.cloud.account,'');
});
test('a pending upload cannot be retried from another local campaign and panels get completion notifications',async()=>{
  const h=fixture();await h.cloud.refresh();h.lose();const c=demoCampaign();let notifications=0;h.cloud.onChange=()=>notifications++;
  await h.cloud.run(()=>h.cloud.save(c,false));assert.ok(h.cloud.pending);
  await h.cloud.run(()=>h.cloud.retry('another-local-campaign'));assert.match(h.cloud.status,/original local campaign/);
  assert.equal(notifications,4);assert.equal(h.cloud.busy,false);
});

import fs from 'fs';

async function test12505612() {
  const token = "Bearer eyJhbGciOiJIUzI1NiJ9.eyJpZCI6OTMwNjgwMiwiZmlyc3ROYW1lIjoiUm9oaXRoIEtyaXNobmFtIFJhanUgIEdhZGlyYWp1IiwibGFzdE5hbWUiOiIiLCJlbWFpbCI6IjEyNTA1NjEyQGxwdS5pbiIsImFwcHMiOiIiLCJvcmdhbml6YXRpb24iOiJscHU3MjQ1OTgiLCJzY2hvb2xOYW1lIjoiTG92ZWx5IFByb2Zlc3Npb25hbCBVbml2ZXJzaXR5IiwiZ3JhZGUiOiJZRUFSIDIiLCJjbGFzc0lkIjo2MjYsInN0dWRlbnRJZCI6OTMwNTI3NSIsImJvYXJkSWQiOjQxNywiaGFzUHJlbWl1bVN1YnNjcmlwdGlvbiI6dHJ1ZSwicm9sZXMiOlsiUk9MRV9JU1RVREVOVCJdLCJtb2JpbGVOdW1iZXIiOiIifQ.zPiU84DDwxlP7OBEFARUcFn6zc7TGVwB71OyaAce5P4";
  
  const r = await fetch('https://corporate.bharatenglish.org/api/orgs/lpu724598/users/12505612/bet-section-insts', {
    headers: { authorization: token }
  });

  console.log('12505612 status:', r.status);
  if (r.ok) {
    const data = await r.json();
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(await r.text());
  }
}

test12505612();

import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { EnidaComponent } from './components/enida/enida.component';
import { SeadComponent } from './components/sead/sead.component';
import { StadenComponent } from './components/staden/staden.component';
import { TilescapeComponent } from './components/tilescape/tilescape.component';
import { VispComponent } from './components/visp/visp.component';
import { WestacComponent } from './components/westac/westac.component';
import { YrkesrumComponent } from './components/yrkesrum/yrkesrum.component';

const routes: Routes = [
  { path: '', component: TilescapeComponent },
  { path: 'sead', component: SeadComponent },
  { path: 'visp', component: VispComponent },
  { path: 'westac', component: WestacComponent },
  { path: 'enida', component: EnidaComponent },
  { path: 'yrkesrum', component: YrkesrumComponent },
  { path: 'staden', component: StadenComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
